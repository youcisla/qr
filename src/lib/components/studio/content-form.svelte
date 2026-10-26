<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select"
  import { Textarea } from "$lib/components/ui/textarea"
  import type { ContentField, ContentValues, QrContentTypeDefinition } from "$lib/qr/content"
  import { cn } from "$lib/utils/style.js"

  import { isFieldVisible } from "./content-utils"

  interface Props {
    typeDef: QrContentTypeDefinition
    values: ContentValues
    errors?: Record<string, string>
    disabled?: boolean
    idPrefix?: string
    onchange: (key: string, value: string | boolean) => void
    class?: string
  }

  let {
    typeDef,
    values,
    errors = {},
    disabled = false,
    idPrefix = "studio-field",
    onchange,
    class: className,
  }: Props = $props()

  const visibleFields = $derived(typeDef.fields.filter((field) => isFieldVisible(field, values)))

  function stringValue(field: ContentField): string {
    const value = values[field.key]
    return typeof value === "string" ? value : value === true ? "true" : ""
  }

  function boolValue(field: ContentField): boolean {
    return values[field.key] === true || values[field.key] === "true"
  }

  function selectedOptionLabel(field: ContentField): string | undefined {
    const current = stringValue(field)
    return field.options?.find((option) => option.value === current)?.label
  }
</script>

<div class={cn("grid gap-4 sm:grid-cols-2", className)}>
  {#each visibleFields as field (field.key)}
    {@const id = `${idPrefix}-${field.key}`}
    {@const error = errors[field.key]}
    {@const helpId = field.help ? `${id}-help` : undefined}
    {@const errorId = error ? `${id}-error` : undefined}
    {@const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined}
    {@const fullWidth = field.fullWidth || field.type === "textarea" || field.type === "checkbox"}

    <div class={cn("space-y-1.5", fullWidth && "sm:col-span-2")}>
      {#if field.type === "checkbox"}
        <div class="flex items-start gap-2.5 pt-1">
          <Checkbox
            {id}
            checked={boolValue(field)}
            {disabled}
            aria-describedby={describedBy}
            onCheckedChange={(checked) => onchange(field.key, checked === true)}
          />
          <div class="space-y-1">
            <Label for={id} class="font-normal">{field.label}</Label>
            {#if field.help}
              <p id={helpId} class="text-xs text-muted-foreground">{field.help}</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="flex items-baseline justify-between gap-2">
          <Label for={id}>
            {field.label}
            {#if field.required}<span class="text-destructive" aria-hidden="true">*</span>{/if}
          </Label>
          {#if field.maxLength && stringValue(field).length > 0}
            <span class="font-mono text-[10px] text-muted-foreground">
              {stringValue(field).length}/{field.maxLength}
            </span>
          {/if}
        </div>

        {#if field.type === "textarea"}
          <Textarea
            {id}
            {disabled}
            rows={field.rows ?? 3}
            value={stringValue(field)}
            placeholder={field.placeholder}
            maxlength={field.maxLength}
            aria-invalid={!!error}
            aria-required={field.required}
            aria-describedby={describedBy}
            class={error ? "border-destructive focus-visible:ring-destructive/20" : undefined}
            oninput={(event) => onchange(field.key, event.currentTarget.value)}
          />
        {:else if field.type === "select"}
          <Select
            type="single"
            value={stringValue(field)}
            onValueChange={(next) => {
              if (next) onchange(field.key, next)
            }}
          >
            <SelectTrigger
              {id}
              class="w-full"
              aria-invalid={!!error}
              aria-required={field.required}
              aria-describedby={describedBy}
              {disabled}
            >
              <span class={selectedOptionLabel(field) ? undefined : "text-muted-foreground"}>
                {selectedOptionLabel(field) ?? field.placeholder ?? "Select an option"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {#each field.options ?? [] as option (option.value)}
                <SelectItem value={option.value}>{option.label}</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        {:else}
          <Input
            {id}
            {disabled}
            type={field.type}
            value={stringValue(field)}
            placeholder={field.placeholder}
            maxlength={field.maxLength}
            inputmode={field.type === "number"
              ? "decimal"
              : field.type === "tel"
                ? "tel"
                : field.type === "email"
                  ? "email"
                  : field.type === "url"
                    ? "url"
                    : undefined}
            autocomplete={field.type === "email"
              ? "email"
              : field.type === "tel"
                ? "tel"
                : undefined}
            aria-invalid={!!error}
            aria-required={field.required}
            aria-describedby={describedBy}
            class={error ? "border-destructive focus-visible:ring-destructive/20" : undefined}
            oninput={(event) => onchange(field.key, event.currentTarget.value)}
          />
        {/if}

        {#if field.help}
          <p id={helpId} class="text-xs text-muted-foreground">{field.help}</p>
        {/if}
        {#if error}
          <p id={errorId} class="text-xs font-medium text-destructive" role="alert">{error}</p>
        {/if}
      {/if}
    </div>
  {/each}
</div>
