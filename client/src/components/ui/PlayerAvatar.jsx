// A stable monogram identifies the seat without implying a real profile photo.
const colors = ['#a7ccb9', '#b9b6d5', '#d5bea4', '#a8c6d4', '#c8b4c4', '#b7c8a0']
export default function PlayerAvatar({ name = '', className = '' }) {
  const letters = [...name.trim()]
  const seed = letters.reduce((total, letter) => total + letter.codePointAt(0), 0)
  const accent = colors[seed % colors.length]
  return <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="31" fill="#172324" stroke={accent} strokeOpacity=".35" />
    <text x="32" y="33" textAnchor="middle" dominantBaseline="central" fill={accent} fontFamily="system-ui, sans-serif" fontSize="24" fontWeight="500">{letters[0]?.toUpperCase() || '♠'}</text>
  </svg>
}
