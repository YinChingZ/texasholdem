import {
  AlertTriangle,
  Club,
  Copy,
  DoorOpen,
  LoaderCircle,
  LogIn,
  Plus,
  Settings,
  Spade,
  Volume2,
  WifiOff,
} from 'lucide-react'

const icons = {
  alert: AlertTriangle,
  club: Club,
  copy: Copy,
  door: DoorOpen,
  loader: LoaderCircle,
  login: LogIn,
  plus: Plus,
  settings: Settings,
  spade: Spade,
  volume: Volume2,
  offline: WifiOff,
}

export function Icon({ name, size = 18, strokeWidth = 1.8, ...props }) {
  const Component = icons[name]
  if (!Component) return null
  return <Component aria-hidden="true" size={size} strokeWidth={strokeWidth} {...props} />
}
