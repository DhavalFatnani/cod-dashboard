import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Phone } from 'lucide-react'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Format phone number - ensure it starts with country code
      let formattedPhone = phone.trim()
      if (!formattedPhone.startsWith('+')) {
        // If no country code, assume India (+91)
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '')
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      })

      if (error) throw error

      setOtpSent(true)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Format phone number
      let formattedPhone = phone.trim()
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone.replace(/^0+/, '')
      }

      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      })

      if (error) throw error

      setUser(data.user)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="card shadow-lg">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              COD Dashboard
            </h2>
            <p className="text-sm text-gray-500">
              {otpSent ? 'Enter the OTP sent to your phone' : 'Sign in with your phone number'}
            </p>
          </div>

          {/* Form */}
          {!otpSent ? (
            <form className="space-y-5" onSubmit={handleSendOTP}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="phone" className="label">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 text-sm">+91</span>
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="input pl-12"
                    placeholder="9876543210"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Enter your 10-digit mobile number
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="btn btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    Send OTP
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={handleVerifyOTP}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                OTP sent to +91{phone}
              </div>

              <div>
                <label htmlFor="otp" className="label">
                  Enter OTP
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the 6-digit OTP
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false)
                    setOtp('')
                    setError('')
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Change Number
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Verifying...
                    </>
                  ) : (
                    'Verify OTP'
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 transition-colors"
              >
                Resend OTP
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Secure phone authentication with OTP
        </p>
      </div>
    </div>
  )
}
