import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useUserStore } from '../stores/userStore'
import { useEffect, useMemo } from 'react'
import {
  LayoutDashboard,
  LogOut,
  User,
  PiggyBank,
  Users,
  FileText,
} from 'lucide-react'
import { NotificationCenter, Notification } from './NotificationCenter'
import { useQuery } from '@tanstack/react-query'
import { ordersService } from '../services/ordersService'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser } = useAuthStore()
  const { profile, loading: profileLoading, fetchProfile } = useUserStore()

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user, fetchProfile])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  const isAdmin = !profileLoading && profile?.role === 'admin'
  const isSM = !profileLoading && profile?.role === 'sm'
  const isASM = !profileLoading && profile?.role === 'asm'
  const isFinance = !profileLoading && (profile?.role === 'finance' || profile?.role === 'admin')

  // Fetch notifications based on role
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', profile?.role, profile?.rider_id, profile?.asm_id],
    queryFn: async () => {
      const notifs: Notification[] = []
      
      if (profile?.role === 'rider' && profile.rider_id) {
        const { data: uncollected } = await ordersService.getOrders({
          payment_type: 'COD',
          money_state: 'UNCOLLECTED',
          rider_id: profile.rider_id,
        })
        if (uncollected.data && uncollected.data.length > 0) {
          notifs.push({
            id: 'rider-uncollected',
            title: 'Orders Pending Collection',
            message: `You have ${uncollected.data.length} order${uncollected.data.length > 1 ? 's' : ''} waiting to be collected`,
            type: 'info',
            actionUrl: '/orders?money_state=UNCOLLECTED',
            actionLabel: 'View Orders',
            priority: 'high',
            timestamp: new Date(),
            role: 'rider',
          })
        }
      }

      if (profile?.role === 'asm' && profile.asm_id) {
        const { data: withRider } = await ordersService.getOrders({
          payment_type: 'COD',
          cod_type: 'COD_HARD',
          money_state: 'COLLECTED_BY_RIDER',
          asm_id: profile.asm_id,
        })
        if (withRider.data && withRider.data.length > 0) {
          notifs.push({
            id: 'asm-collect-from-rider',
            title: 'Orders with Riders',
            message: `${withRider.data.length} order${withRider.data.length > 1 ? 's' : ''} ready for collection from riders`,
            type: 'warning',
            actionUrl: '/asm/handover',
            actionLabel: 'View Orders',
            priority: 'high',
            timestamp: new Date(),
            role: 'asm',
          })
        }
      }

      if (profile?.role === 'sm') {
        const { data: pending } = await ordersService.getOrders({
          payment_type: 'COD',
          money_state: 'HANDOVER_TO_ASM',
        })
        if (pending.data && pending.data.length > 0) {
          notifs.push({
            id: 'sm-pending-deposits',
            title: 'Orders Ready for Deposit',
            message: `${pending.data.length} order${pending.data.length > 1 ? 's' : ''} ready for deposit creation`,
            type: 'info',
            actionUrl: '/sm/deposits',
            actionLabel: 'Create Deposit',
            priority: 'high',
            timestamp: new Date(),
            role: 'sm',
          })
        }
      }

      return notifs
    },
    enabled: !profileLoading && !!profile,
    refetchInterval: 10000,
  })

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(isSM ? [{ path: '/sm/deposits', label: 'SM Deposits', icon: PiggyBank }] : []),
    ...(isASM ? [{ path: '/asm/handover', label: 'ASM Handover', icon: Users }] : []),
    ...(isFinance ? [{ path: '/finance', label: 'Finance Reconciliation', icon: FileText }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col shadow-sm">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">COD Dashboard</h1>
              <p className="text-xs text-gray-500 mt-1">Cash Management</p>
            </div>
            <NotificationCenter notifications={notifications} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name || profile?.phone || profile?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile?.role || (profile?.phone ? 'asm' : 'User')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
