<script lang="ts">
  import {
    Check,
    CircleCheck,
    Copy,
    Frame,
    ImagePlus,
    LayoutTemplate,
    LoaderCircle,
    Palette,
    Shapes,
    ShieldCheck,
    Sparkles,
    Tag,
    X,
  } from "@lucide/svelte"
  import { goto, replaceState } from "$app/navigation"
  import { Badge } from "$lib/components/ui/badge"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Separator } from "$lib/components/ui/separator"
  import { Toaster } from "$lib/components/ui/sonner"
  import { Switch } from "$lib/components/ui/switch"
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs"
  import { Textarea } from "$lib/components/ui/textarea"
  import { contrastRatio, effectiveFillColor, relativeLuminance } from "$lib/qr/color"
  import {
    defaultValuesFor,
    getContentTypeOrDefault,
    withDefaults,
    type ContentValues,
  } from "$lib/qr/content"
  import { renderQrSvg } from "$lib/qr/render"
  import { getTemplate, templates } from "$lib/qr/templates"
  import {
    resolveDesign,
    type QrDesign,
    type QrFrameOptions,
    type QrLogoOptions,
  } from "$lib/qr/types"
  import {
    getGenerationCount,
    GUEST_GENERATION_LIMIT,
    incrementGeneration,
  } from "$lib/utils/usage-tracker"
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"

  import ColorField from "./color-field.svelte"
  import ContentForm from "./content-form.svelte"
  import { collectErrors, encodeValues, firstError, sampleData } from "./content-utils"
  import ExportPanel from "./export-panel.svelte"
  import FillEditor from "./fill-editor.svelte"
  import FrameControl from "./frame-control.svelte"
  import LogoControl from "./logo-control.svelte"
  import QrPreview from "./qr-preview.svelte"
  import ScanTest from "./scan-test.svelte"
  import ShapeControls from "./shape-controls.svelte"
  import TemplateGallery from "./template-gallery.svelte"
  import TypePicker from "./type-picker.svelte"
  import WarningPanel from "./warning-panel.svelte"

  interface InitialQr {
    id: string
    contentType: string
    contentData: ContentValues
    title: string | null
    description: string | null
    tags: string[]
    type: "static" | "dynamic"
    status: string
    shortCode: string | null
    shortUrl: string | null
    design: QrDesign
    encodeTarget: string
  }

  interface Prefill {
    type: string
    values: ContentValues
  }

  interface Props {
    user?: App.Locals["session"] | null
    origin?: string
    qr?: InitialQr | null
    prefill?: Prefill | null
  }

  let { user = null, origin = "", qr = null, prefill = null }: Props = $props()

  const initialTypeId = qr?.contentType ?? prefill?.type ?? "url"

  let contentTypeId = $state(initialTypeId)
  let values = $state<ContentValues>(
    (() => {
      const type = getContentTypeOrDefault(initialTypeId)
      if (qr && qr.contentType === initialTypeId) return withDefaults(type, qr.contentData)
      if (prefill && prefill.type === initialTypeId) return withDefaults(type, prefill.values)
      return defaultValuesFor(type)
    })(),
  )
  let drafts = $state<Record<string, ContentValues>>({})
  let design = $state<QrDesign>(resolveDesign(qr?.design ?? null))
  let selectedTemplateId = $state<string | null>(qr ? null : "classic")
  let designTab = $state("templates")
  let title = $state(qr?.title ?? "")
  let description = $state(qr?.description ?? "")
  let tags = $state<string[]>(qr?.tags ?? [])
  let tagDraft = $state("")
  let dynamic = $state(qr?.type === "dynamic")
  let attemptedSave = $state(false)
  let saving = $state(false)
  let savedId = $state<string | null>(qr?.id ?? null)
  let savedShortUrl = $state<string | null>(qr?.shortUrl ?? null)
  let savedEncodeTarget = $state<string | null>(qr?.type === "dynamic" ? qr.encodeTarget : null)
  let guestUsed = $state(0)
  let copyingLink = $state(false)

  onMount(() => {
    guestUsed = getGenerationCount()
  })

  const isEdit = $derived(Boolean(qr?.id ?? savedId))
  const typeDef = $derived(getContentTypeOrDefault(contentTypeId))
  const encoded = $derived(encodeValues(typeDef, values))
  const examplePayload = $derived(sampleData(typeDef))
  const dynamicTarget = $derived(
    savedEncodeTarget ?? (qr?.type === "dynamic" ? qr.encodeTarget : null),
  )
  const previewData = $derived(
    dynamicTarget ?? encoded.data ?? examplePayload ?? "https://yopem.com",
  )
  const usingExample = $derived(!dynamicTarget && !encoded.data)
  const errors = $derived(collectErrors(typeDef, values))
  const shownErrors = $derived.by(() => {
    if (attemptedSave) return errors
    const filtered: Record<string, string> = {}
    for (const [key, message] of Object.entries(errors)) {
      const value = values[key]
      const filled = typeof value === "string" ? value.trim().length > 0 : value === true
      if (filled) filtered[key] = message
    }
    return filtered
  })
  const dynamicConflict = $derived(dynamic && !typeDef.supportsDynamic)

  const preview = $derived.by(() => {
    try {
      return renderQrSvg({ data: previewData, design, size: 720 })
    } catch {
      return null
    }
  })
  const warnings = $derived(preview?.warnings ?? [])
  const blocked = $derived(warnings.some((warning) => warning.level === "error"))
  const infoChips = $derived(
    preview
      ? [
          `v${preview.matrix.version}`,
          `${preview.matrix.size} × ${preview.matrix.size}`,
          `EC ${design.errorCorrection}`,
        ]
      : [],
  )

  const filenameBase = $derived.by(() => {
    const typed = title.trim()
    if (typed) return typed
    const summary = typeDef.summarize?.(values)
    return summary && summary.trim().length > 0 ? summary.trim() : "qr-code"
  })

  const jpegBackground = $derived(
    !design.transparentBackground && design.background.type === "solid"
      ? design.background.color
      : "#ffffff",
  )

  const remainingExports = $derived(user ? null : Math.max(0, GUEST_GENERATION_LIMIT - guestUsed))

  const payloadJson = $derived(
    JSON.stringify({
      id: savedId ?? undefined,
      contentType: typeDef.id,
      contentData: values,
      title: title.trim() || null,
      description: description.trim() || null,
      tags,
      type: dynamic ? "dynamic" : "static",
      design,
    }),
  )

  const designTabs = [
    { value: "templates", label: "Templates", icon: LayoutTemplate },
    { value: "shape", label: "Shape", icon: Shapes },
    { value: "colors", label: "Colors", icon: Palette },
    { value: "logo", label: "Logo", icon: ImagePlus },
    { value: "frame", label: "Frame", icon: Frame },
  ]

  $effect(() => {
    if (!isEdit && dynamic && !typeDef.supportsDynamic) dynamic = false
  })

  function selectType(id: string) {
    if (id === contentTypeId) return
    drafts = { ...drafts, [contentTypeId]: values }
    contentTypeId = id
    const nextType = getContentTypeOrDefault(id)
    const draft = drafts[id]
    values = draft ? withDefaults(nextType, draft) : defaultValuesFor(nextType)
    attemptedSave = false
  }

  function setFieldValue(key: string, value: string | boolean) {
    values = { ...values, [key]: value }
  }

  function useExample() {
    values = withDefaults(typeDef, typeDef.sample)
    toast.info("Example content added", {
      description: "Replace it with your own details before downloading.",
    })
  }

  function patchDesign(patch: Partial<QrDesign>) {
    design = resolveDesign({ ...design, ...patch })
    if (patch.logo === undefined) selectedTemplateId = null
  }

  function applyTemplate(templateId: string) {
    const template = getTemplate(templateId)
    if (!template) return
    design = resolveDesign(template.design)
    selectedTemplateId = template.id
    toast.success(`${template.name} template applied`, {
      description: "Fine-tune it in Shape, Colors, Logo and Frame.",
    })
  }

  function resetDesign() {
    design = resolveDesign(null)
    selectedTemplateId = "classic"
    toast.info("Design reset to the default style")
  }

  function changeLogo(logo: QrLogoOptions | null) {
    const raised = Boolean(logo) && design.errorCorrection !== "H"
    design = resolveDesign({
      ...design,
      logo,
      errorCorrection: raised ? "H" : design.errorCorrection,
    })
    if (raised) {
      toast.info("Error correction raised to H", {
        description: "Logo recovery needs 30% redundancy. You can lower it again in Shape.",
      })
    }
  }

  /** One-click safe defaults that clear blocking scanability errors. */
  function autoFixDesign() {
    const changes: string[] = []
    let next = resolveDesign(design)

    if (next.quietZone < 4) {
      next = { ...next, quietZone: 4 }
      changes.push("quiet zone set to 4")
    }
    if (next.moduleGap > 0.2) {
      next = { ...next, moduleGap: 0.08 }
      changes.push("module spacing reduced")
    }
    if (next.logo && next.logo.size > 0.2) {
      next = { ...next, logo: { ...next.logo, size: 0.2 } }
      changes.push("logo shrunk to 20%")
    }
    if (next.logo && next.errorCorrection !== "H") {
      next = { ...next, errorCorrection: "H" }
      changes.push("error correction raised to H")
    }

    const foreground = effectiveFillColor(next.foreground)
    const background = next.transparentBackground ? "#ffffff" : effectiveFillColor(next.background)
    const lowContrast = contrastRatio(foreground, background) < 4.5
    if (lowContrast || relativeLuminance(foreground) > relativeLuminance(background)) {
      if (next.transparentBackground) {
        next = {
          ...next,
          transparentBackground: false,
          background: { type: "solid", color: "#ffffff" },
        }
        changes.push("background set to white")
      }
      const darkBackground = relativeLuminance(effectiveFillColor(next.background)) < 0.5
      if (darkBackground) {
        next = { ...next, foreground: { type: "solid", color: "#ffffff" } }
        changes.push("modules set to white")
      } else {
        next = {
          ...next,
          foreground: { type: "solid", color: "#0f172a" },
          background: { type: "solid", color: "#ffffff" },
        }
        changes.push("ink on white contrast restored")
      }
      next = { ...next, eyeFrameColor: null, eyeBallColor: null }
    }

    design = next
    selectedTemplateId = null
    toast.success("Design auto-fixed", {
      description: changes.length > 0 ? changes.join(" · ") : "Applied safe defaults.",
    })
  }

  function changeFrame(frame: QrFrameOptions | null) {
    design = resolveDesign({ ...design, frame })
  }

  function hasCustomEyeColors(): boolean {
    return design.eyeFrameColor !== null || design.eyeBallColor !== null
  }

  function toggleEyeColors(checked: boolean) {
    if (checked) {
      const base = design.foreground.type === "solid" ? design.foreground.color : "#0f172a"
      patchDesign({ eyeFrameColor: base, eyeBallColor: base })
    } else {
      patchDesign({ eyeFrameColor: null, eyeBallColor: null })
    }
  }

  function addTag() {
    const candidate = tagDraft.trim().replace(/,$/, "").slice(0, 40)
    if (!candidate) {
      tagDraft = ""
      return
    }
    if (tags.length >= 20 || tags.includes(candidate)) {
      tagDraft = ""
      return
    }
    tags = [...tags, candidate]
    tagDraft = ""
  }

  function removeTag(tag: string) {
    tags = tags.filter((entry) => entry !== tag)
  }

  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      addTag()
    } else if (event.key === "Backspace" && !tagDraft && tags.length > 0) {
      tags = tags.slice(0, -1)
    }
  }

  function handleExported() {
    if (user) return
    incrementGeneration()
    guestUsed = getGenerationCount()
  }

  async function copyShortUrl() {
    if (!savedShortUrl || copyingLink) return
    copyingLink = true
    try {
      await navigator.clipboard.writeText(savedShortUrl)
      toast.success("Short link copied")
    } catch {
      toast.error("Clipboard is not available")
    } finally {
      copyingLink = false
    }
  }

  async function save(options: { exit?: boolean } = {}) {
    if (saving) return
    attemptedSave = true
    if (!user) {
      toast.info("Sign in to save your QR code", {
        description: "You can still download the files for free.",
      })
      return
    }
    if (dynamicConflict) {
      toast.error("Dynamic QR codes need a link content type", {
        description: "Choose Website, App Store, Social or PayPal, or turn Dynamic off.",
      })
      return
    }
    if (Object.keys(errors).length > 0) {
      toast.error("Check the highlighted fields", {
        description: firstError(errors) ?? "Some content is missing or invalid.",
      })
      return
    }
    saving = true
    try {
      const body = new FormData()
      body.set("payload", payloadJson)
      const response = await fetch("?/save", {
        method: "POST",
        body,
        headers: { accept: "application/json", "x-sveltekit-action": "true" },
      })
      const result = (await response.json()) as {
        type: "success" | "failure" | "redirect" | "error"
        status?: number
        data?: Record<string, unknown>
      }
      if (result.type === "success" && result.data?.saved) {
        const id = String(result.data.id)
        const wasEdit = Boolean(savedId)
        savedId = id
        savedShortUrl = typeof result.data.shortUrl === "string" ? result.data.shortUrl : null
        savedEncodeTarget =
          typeof result.data.encodeTarget === "string" && result.data.encodeTarget.length > 0
            ? result.data.encodeTarget
            : savedEncodeTarget
        if (!wasEdit) {
          replaceState(`${window.location.pathname}?edit=${id}`, {})
          toast.success("QR code saved", {
            description: dynamic
              ? "Your short link is ready — download the code and print it."
              : "Find and manage it in your dashboard.",
            action: { label: "Dashboard", onClick: () => goto("/dashboard") },
          })
        } else {
          toast.success("Changes saved")
        }
        if (options.exit) {
          await goto("/dashboard")
        }
      } else if (result.type === "failure") {
        toast.error(String(result.data?.error ?? "Could not save your QR code"))
      } else if (result.type === "redirect") {
        await goto("/auth/login")
      } else {
        toast.error("Could not save your QR code")
      }
    } catch (caught) {
      toast.error("Network error", {
        description: caught instanceof Error ? caught.message : "Please try again.",
      })
    } finally {
      saving = false
    }
  }
</script>

<Toaster position="top-center" />

{#snippet saveCard()}
  <div class="rounded-2xl border bg-card p-4 shadow-sm">
    {#if user}
      <p class="text-sm font-semibold">{isEdit ? "Save changes" : "Save your QR code"}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        {#if dynamic}
          The saved code points to a short link you can edit, pause or track later.
        {:else}
          Saved codes appear in your dashboard with analytics and bulk actions.
        {/if}
      </p>
      <Button
        type="button"
        class="mt-3 w-full gap-2"
        disabled={saving || dynamicConflict}
        onclick={() => save()}
      >
        {#if saving}
          <LoaderCircle class="size-4 animate-spin" />
          Saving…
        {:else}
          <Check class="size-4" />
          {isEdit ? "Save changes" : "Save QR code"}
        {/if}
      </Button>
      <Button
        type="button"
        variant="outline"
        class="mt-2 w-full"
        disabled={saving || dynamicConflict}
        onclick={() => save({ exit: true })}
      >
        Save &amp; open dashboard
      </Button>
      {#if savedShortUrl}
        <div class="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
          <span class="truncate font-mono text-[11px] text-muted-foreground">{savedShortUrl}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            class="ms-auto shrink-0"
            aria-label="Copy short link"
            disabled={copyingLink}
            onclick={copyShortUrl}
          >
            <Copy class="size-3" />
          </Button>
        </div>
      {/if}
      {#if dynamicConflict}
        <p class="mt-2 text-xs text-destructive">
          {typeDef.name} cannot be dynamic. Switch back to Website, App Store, Social or PayPal, or turn
          Dynamic off.
        </p>
      {/if}
    {:else}
      <p class="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck class="size-4 text-success-foreground" />
        Save this design
      </p>
      <p class="mt-1 text-xs text-muted-foreground">
        Create a free account to store QR codes, edit dynamic links and see scan analytics.
        Downloads stay free.
      </p>
      <ul class="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <li class="flex items-center gap-2">
          <Check class="size-3 text-success-foreground" /> Unlimited saved QR codes
        </li>
        <li class="flex items-center gap-2">
          <Check class="size-3 text-success-foreground" /> Dynamic short links you can edit later
        </li>
        <li class="flex items-center gap-2">
          <Check class="size-3 text-success-foreground" /> Scan analytics by device and country
        </li>
      </ul>
      <Button href="/auth/login" class="mt-3 w-full">Sign in to save</Button>
      <p class="mt-2 text-center text-[11px] text-muted-foreground">
        {remainingExports ?? GUEST_GENERATION_LIMIT} free downloads left this session
      </p>
    {/if}
  </div>
{/snippet}

<div class="space-y-6">
  <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div class="space-y-1.5">
      <div class="flex items-center gap-2">
        <p class="text-sm font-semibold tracking-[0.2em] text-primary uppercase">QR Studio</p>
        {#if isEdit}
          <Badge variant="outline" size="sm">{qr?.status ?? "saved"}</Badge>
        {/if}
        {#if dynamic}
          <Badge variant="info" size="sm">Dynamic</Badge>
        {/if}
      </div>
      <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
        {isEdit ? "Edit your QR code" : "Design a QR code"}
      </h1>
      <p class="max-w-2xl text-sm text-muted-foreground sm:text-base">
        Pick a content type, style it like a brand asset and export it in one click. Every change is
        rendered live, with a scanability check before you print.
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {#if user}
        <Badge variant="success" size="lg" class="gap-1">
          <CircleCheck class="size-3" />
          Signed in
        </Badge>
        <Button variant="outline" href="/dashboard">My QR codes</Button>
      {:else}
        <Badge variant="warning" size="lg">Guest mode</Badge>
        <Button variant="outline" href="/auth/login">Sign in to save</Button>
      {/if}
    </div>
  </header>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start lg:gap-8">
    <!-- Preview + export rail (first on mobile, sticky on desktop) -->
    <aside
      class="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1 lg:pb-4"
    >
      <QrPreview
        svg={preview?.svg ?? null}
        width={preview?.width ?? 1}
        height={preview?.height ?? 1}
        {warnings}
        info={infoChips}
        example={usingExample}
        {dynamic}
      />

      <WarningPanel {warnings} />

      {#if user}
        {@render saveCard()}
      {/if}

      <ScanTest
        svg={preview?.svg ?? null}
        width={preview?.width ?? 1}
        height={preview?.height ?? 1}
        expectedData={previewData}
      />

      <ExportPanel
        svg={preview?.svg ?? null}
        width={preview?.width ?? 1}
        height={preview?.height ?? 1}
        moduleCount={preview?.matrix.size ?? null}
        quietZone={design.quietZone}
        {filenameBase}
        {jpegBackground}
        {blocked}
        contentReady={!usingExample}
        onAutoFix={autoFixDesign}
        {remainingExports}
        onExported={handleExported}
      />

      {#if !user}
        {@render saveCard()}
      {/if}

      <p class="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Tip: keep at least 4 modules of quiet zone, avoid light modules on dark backgrounds and keep
        logos under 25% of the code. The scanability panel updates as you design. Unique scans are
        counted per hashed visitor (IP + user agent, 24h window); raw IP addresses are never stored.
      </p>
    </aside>

    <!-- Editor column -->
    <div class="order-2 space-y-6 lg:order-1">
      <section class="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div class="flex items-start gap-3">
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold"
            >
              1
            </span>
            <div>
              <h2 class="text-base font-semibold">Content</h2>
              <p class="text-xs text-muted-foreground">What happens when someone scans the code?</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" class="gap-1.5" onclick={useExample}>
              <Sparkles class="size-3.5" />
              Use example
            </Button>
          </div>
        </div>

        <div class="space-y-5 p-5">
          <TypePicker value={contentTypeId} onchange={selectType} />

          <Separator />

          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold">{typeDef.name}</h3>
              <p class="text-xs text-muted-foreground">{typeDef.description}</p>
            </div>
            {#if encoded.data}
              <Badge variant="success" size="sm" class="gap-1">
                <Check class="size-3" />
                {encoded.data.length} chars
              </Badge>
            {:else}
              <Badge variant="outline" size="sm">Preview uses example data</Badge>
            {/if}
          </div>

          <ContentForm
            {typeDef}
            {values}
            errors={shownErrors}
            onchange={setFieldValue}
            idPrefix="studio-content"
          />

          {#if attemptedSave && Object.keys(errors).length > 0}
            <p
              class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
            >
              {Object.keys(errors).length} field(s) still need attention before you can
              {isEdit ? "save" : "create"} this QR code.
            </p>
          {/if}

          <div class="space-y-4 rounded-xl border bg-muted/20 p-4">
            <p class="text-sm font-semibold">Details</p>
            <div class="space-y-1.5">
              <Label for="studio-title">{user ? "Title" : "Title / file name"}</Label>
              <Input
                id="studio-title"
                type="text"
                bind:value={title}
                maxlength={100}
                placeholder="Untitled QR code"
              />
            </div>

            {#if user}
              <div class="space-y-1.5">
                <Label for="studio-description"
                  >Description <span class="text-muted-foreground">(optional)</span></Label
                >
                <Textarea
                  id="studio-description"
                  bind:value={description}
                  rows={2}
                  maxlength={500}
                  placeholder="Where is this code used? What campaign is it part of?"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="studio-tags"
                  >Tags <span class="text-muted-foreground">(optional)</span></Label
                >
                {#if tags.length > 0}
                  <div class="flex flex-wrap gap-1.5">
                    {#each tags as tag (tag)}
                      <span
                        class="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]"
                      >
                        <Tag class="size-2.5 text-muted-foreground" />
                        {tag}
                        <button
                          type="button"
                          class="rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                          aria-label={`Remove tag ${tag}`}
                          onclick={() => removeTag(tag)}
                        >
                          <X class="size-2.5" />
                        </button>
                      </span>
                    {/each}
                  </div>
                {/if}
                <Input
                  id="studio-tags"
                  type="text"
                  bind:value={tagDraft}
                  placeholder="Add a tag and press Enter"
                  maxlength={40}
                  onkeydown={handleTagKeydown}
                  onblur={addTag}
                />
              </div>
            {/if}

            <div class="rounded-lg border bg-background/60 p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">Dynamic QR code</p>
                  <p class="text-xs text-muted-foreground">
                    {#if typeDef.supportsDynamic}
                      Print once and change the destination any time — with scan tracking.
                    {:else}
                      {typeDef.name} codes are static-only. Dynamic is available for Website, App Store,
                      Social and PayPal.
                    {/if}
                  </p>
                </div>
                <Switch
                  checked={dynamic}
                  disabled={!typeDef.supportsDynamic || !user || isEdit}
                  aria-label="Make this a dynamic QR code"
                  onCheckedChange={(checked) => {
                    if (!user) {
                      toast.info("Sign in to create dynamic QR codes", {
                        description: "Dynamic codes can be edited after printing.",
                      })
                      return
                    }
                    if (isEdit) {
                      toast.info("The QR type cannot change after saving")
                      return
                    }
                    dynamic = checked
                  }}
                />
              </div>
              {#if !user && typeDef.supportsDynamic}
                <p class="mt-2 text-[11px] text-muted-foreground">
                  <a class="font-medium underline" href="/auth/login">Sign in</a> to unlock dynamic codes,
                  editable links and analytics.
                </p>
              {:else if isEdit}
                <p class="mt-2 text-[11px] text-muted-foreground">
                  {dynamic
                    ? "This code is dynamic: it always scans to its short link."
                    : "This code is static: its payload is frozen after printing."}
                </p>
              {/if}
              {#if dynamicConflict}
                <p class="mt-2 text-[11px] font-medium text-destructive">
                  Choose a link-type content to keep this code dynamic.
                </p>
              {/if}
            </div>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div class="flex items-start gap-3">
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold"
            >
              2
            </span>
            <div>
              <h2 class="text-base font-semibold">Design</h2>
              <p class="text-xs text-muted-foreground">
                Start from a template or craft every detail yourself.
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onclick={resetDesign}>Reset</Button>
        </div>

        <Tabs bind:value={designTab} class="gap-0">
          <div class="border-b px-3 py-3 sm:px-5">
            <TabsList class="grid h-auto w-full min-w-0 grid-cols-5">
              {#each designTabs as tab (tab.value)}
                {@const TabIcon = tab.icon}
                <TabsTrigger
                  value={tab.value}
                  aria-label={tab.label}
                  class="min-w-0 gap-1 px-0.5 py-1.5 text-[10px] sm:gap-1.5 sm:px-1 sm:text-xs"
                >
                  <TabIcon class="size-3.5 shrink-0" />
                  <span class="truncate">{tab.label}</span>
                </TabsTrigger>
              {/each}
            </TabsList>
          </div>

          <div class="p-5">
            <TabsContent value="templates">
              <TemplateGallery
                selectedId={selectedTemplateId}
                onselect={(template) => applyTemplate(template.id)}
              />
            </TabsContent>

            <TabsContent value="shape">
              <ShapeControls {design} onDesignChange={patchDesign} />
            </TabsContent>

            <TabsContent value="colors" class="space-y-6">
              <FillEditor
                idPrefix="studio-fg"
                label="QR colour"
                description="Used for modules and, unless overridden, the eyes."
                value={design.foreground}
                onchange={(fill) => patchDesign({ foreground: fill })}
              />

              <FillEditor
                idPrefix="studio-bg"
                label="Background"
                description="The canvas behind the modules and quiet zone."
                value={design.background}
                onchange={(fill) => patchDesign({ background: fill })}
              />

              <div
                class="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3"
              >
                <div>
                  <p class="text-sm font-medium">Transparent background</p>
                  <p class="text-xs text-muted-foreground">
                    Leaves no fill behind the code. Best on white or light surfaces.
                  </p>
                </div>
                <Switch
                  checked={design.transparentBackground}
                  aria-label="Transparent background"
                  onCheckedChange={(checked) => patchDesign({ transparentBackground: checked })}
                />
              </div>

              <div class="space-y-4 rounded-xl border bg-muted/20 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">Custom eye colours</p>
                    <p class="text-xs text-muted-foreground">
                      Colour the finder patterns separately from the modules.
                    </p>
                  </div>
                  <Switch
                    checked={hasCustomEyeColors()}
                    aria-label="Custom eye colours"
                    onCheckedChange={toggleEyeColors}
                  />
                </div>
                {#if hasCustomEyeColors()}
                  <div class="grid gap-4 sm:grid-cols-2">
                    <ColorField
                      id="studio-eye-frame"
                      label="Eye frame"
                      value={design.eyeFrameColor ?? "#0f172a"}
                      onchange={(value) => patchDesign({ eyeFrameColor: value })}
                    />
                    <ColorField
                      id="studio-eye-ball"
                      label="Eye ball"
                      value={design.eyeBallColor ?? "#0f172a"}
                      onchange={(value) => patchDesign({ eyeBallColor: value })}
                    />
                  </div>
                {/if}
              </div>
            </TabsContent>

            <TabsContent value="logo">
              <LogoControl
                logo={design.logo}
                errorCorrection={design.errorCorrection}
                onchange={changeLogo}
              />
            </TabsContent>

            <TabsContent value="frame">
              <FrameControl frame={design.frame} onchange={changeFrame} />
            </TabsContent>
          </div>
        </Tabs>
      </section>

      <p class="pb-4 text-center text-xs text-muted-foreground">
        Design {selectedTemplateId
          ? `based on the “${getTemplate(selectedTemplateId)?.name ?? ""}” template`
          : "customised from scratch"}
        · {templates.length} templates available
        {#if origin}
          · short links use {origin.replace(/^https?:\/\//, "")}
        {/if}
      </p>
    </div>
  </div>
</div>
