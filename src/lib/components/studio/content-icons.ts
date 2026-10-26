import {
  AppWindow,
  Banknote,
  Bitcoin,
  Calendar,
  CalendarDays,
  Contact,
  CreditCard,
  Globe,
  IdCard,
  Landmark,
  Link,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Share2,
  ShoppingBag,
  Smartphone,
  Type,
  User,
  Wallet,
  Wifi,
} from "@lucide/svelte"
import type { Component } from "svelte"

type IconComponent = Component<{ class?: string }>

/**
 * Lucide icons used by the content-type picker. The registry stores a lucide
 * icon *name* (e.g. "link", "wifi"), resolved here so the UI never depends on
 * the codec modules importing icon components themselves.
 */
const iconMap: Record<string, IconComponent> = {
  link: Link,
  "link-2": Link,
  globe: Globe,
  text: Type,
  type: Type,
  mail: Mail,
  email: Mail,
  phone: Phone,
  "phone-call": Phone,
  sms: MessageSquare,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  whatsapp: MessageCircle,
  wifi: Wifi,
  contact: Contact,
  "contact-round": Contact,
  user: User,
  "id-card": IdCard,
  "map-pin": MapPin,
  "map-pin-house": MapPin,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  bitcoin: Bitcoin,
  crypto: Bitcoin,
  coins: Banknote,
  landmark: Landmark,
  banknote: Banknote,
  wallet: Wallet,
  smartphone: Smartphone,
  "app-window": AppWindow,
  app: Smartphone,
  "share-2": Share2,
  share: Share2,
  social: Share2,
  "credit-card": CreditCard,
  paypal: Wallet,
  "shopping-bag": ShoppingBag,
}

function normalizeIconName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^lucide[-/]/i, "")
    .replace(/[\s_]+/g, "-")
}

export function contentIcon(name: string | undefined): IconComponent {
  if (!name) return Link
  return iconMap[normalizeIconName(name)] ?? Link
}
