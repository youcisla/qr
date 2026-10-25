import { issuer } from "@openauthjs/openauth"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import type {
  PasswordRegisterError,
  PasswordRegisterState,
} from "@openauthjs/openauth/provider/password"
import { PasswordUI } from "@openauthjs/openauth/ui/password"

import { subjects } from "$lib/auth/subjects"

import { postgresStorage } from "./storage"

const copy = {
  login_title: "Sign in",
  login_description: "Sign in with your email and password",
  register_title: "Create an account",
  register_description: "Register with your email and password",
  login: "Sign in",
  register: "Create account",
  register_prompt: "No account yet?",
  login_prompt: "Already registered?",
  change_prompt: "Forgot your password?",
  input_email: "Email",
  input_password: "Password",
  input_repeat: "Repeat password",
  input_code: "Verification code",
  button_continue: "Continue",
  error_email_taken: "An account with this email already exists.",
  error_invalid_code: "The code is incorrect.",
  error_invalid_email: "Enter a valid email.",
  error_invalid_password: "Email or password is incorrect.",
  error_password_mismatch: "Passwords do not match.",
  error_validation_error: "Password must be at least 8 characters.",
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char,
  )

function page(title: string, body: string) {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #f6f6f7; --card: #fff; --fg: #18181b; --muted: #6b7280; --line: #d4d4d8; --accent: #18181b; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0f; --card: #16161c; --fg: #f4f4f5; --muted: #a1a1aa; --line: #3f3f46; --accent: #f4f4f5; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--fg); font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { width: 100%; max-width: 380px; padding: 28px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  h1 { margin: 0 0 16px; font-size: 20px; }
  label { display: block; margin: 12px 0; font-size: 13px; color: var(--muted); }
  input { display: block; width: 100%; margin-top: 4px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: var(--fg); font: inherit; }
  button { width: 100%; margin-top: 8px; padding: 10px 12px; border: 0; border-radius: 8px; background: var(--accent); color: var(--bg); font: inherit; font-weight: 600; cursor: pointer; }
  a { color: inherit; }
  .hint, .muted { color: var(--muted); font-size: 13px; }
  .error { margin: 12px 0 0; padding: 8px 10px; border-radius: 8px; background: #fee2e2; color: #991b1b; font-size: 13px; }
  .code { margin: 8px 0; font: 600 28px/1 ui-monospace, monospace; letter-spacing: 6px; }
</style>
</head>
<body><main>${body}</main></body>
</html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  )
}

async function register(
  _req: Request,
  state: PasswordRegisterState,
  form?: FormData,
  error?: PasswordRegisterError,
) {
  const message = error ? (copy[`error_${error.type}` as keyof typeof copy] ?? "") : ""

  if (state.type === "code") {
    return page(
      "Verify your email",
      `<h1>Verify your email</h1>
       <p class="muted">Code for <strong>${escape(state.email)}</strong></p>
       <p class="code">${escape(state.code)}</p>
       <p class="hint">Email delivery is not configured on this deployment, so the code is shown here.</p>
       ${message ? `<p class="error">${escape(message)}</p>` : ""}
       <form method="post">
         <input type="hidden" name="action" value="verify">
         <label>Code<input name="code" inputmode="numeric" autocomplete="one-time-code" required minlength="6" maxlength="6" autofocus></label>
         <button type="submit">Verify</button>
       </form>`,
    )
  }

  return page(
    "Create an account",
    `<h1>Create an account</h1>
     ${message ? `<p class="error">${escape(message)}</p>` : ""}
     <form method="post">
       <input type="hidden" name="action" value="register">
       <label>Email<input type="email" name="email" autocomplete="email" required value="${escape(form?.get("email")?.toString() ?? "")}"></label>
       <label>Password<input type="password" name="password" autocomplete="new-password" required minlength="8"></label>
       <label>Repeat password<input type="password" name="repeat" autocomplete="new-password" required minlength="8"></label>
       <button type="submit">Continue</button>
     </form>
     <p class="hint">Already registered? <a href="authorize">Sign in</a></p>`,
  )
}

async function change() {
  return page(
    "Password reset",
    `<h1>Password reset unavailable</h1>
     <p class="muted">This deployment has no email delivery configured, so passwords cannot be reset automatically.</p>
     <p><a href="authorize">Back to sign in</a></p>`,
  )
}

const password = PasswordUI({
  copy,
  validatePassword: (value) => (value.length < 8 ? copy.error_validation_error : undefined),
  sendCode: async () => {},
})

export const authIssuer = issuer({
  providers: {
    password: PasswordProvider({ ...password, register, change }),
  },
  subjects,
  storage: postgresStorage(),
  success: async (ctx, value) => {
    const email = String((value as { email: string }).email).toLowerCase()
    const username = email.split("@")[0].slice(0, 50) || "user"
    return ctx.subject("user", {
      id: email,
      email,
      name: username,
      username,
      image: null,
      role: "user",
    })
  },
})
