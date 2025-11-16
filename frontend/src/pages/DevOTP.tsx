import { useMemo } from 'react'

function generateDevOtp(phone: string): string {
  const base = Math.abs(Array.from(phone).reduce((acc, c) => acc * 33 + c.charCodeAt(0), 7))
  const window = Math.floor(Date.now() / (5 * 60 * 1000))
  return ((base + window) % 1_000_000).toString().padStart(6, '0')
}

export default function DevOTP() {
  const phones = useMemo(() => ['+15551230001', '+15551230002', '+15551230003'], [])
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Dev OTP Harness</h1>
      <p className="text-sm text-gray-600 mb-4">Non-production only. Copy OTPs for test phones.</p>
      <div className="space-y-2">
        {phones.map((p) => (
          <div key={p} className="flex items-center justify-between border rounded px-3 py-2">
            <span className="font-mono">{p}</span>
            <code className="font-mono text-lg">{generateDevOtp(p)}</code>
          </div>
        ))}
      </div>
    </div>
  )
}
