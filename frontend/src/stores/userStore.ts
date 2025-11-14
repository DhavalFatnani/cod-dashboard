import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'finance' | 'asm' | 'rider' | 'viewer' | 'sm'
  rider_id: string | null
  asm_id: string | null
  store_id: string | null
  sm_id?: string | null
  phone: string | null
}

interface UserState {
  profile: UserProfile | null
  loading: boolean
  fetchProfile: () => Promise<void>
}

// Normalize phone number to consistent format (+91XXXXXXXXXX)
function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')
  
  // If starts with +91, return as is
  if (cleaned.startsWith('+91')) {
    return cleaned
  }
  
  // If starts with 91 (without +), add +
  if (cleaned.startsWith('91') && cleaned.length >= 12) {
    return '+' + cleaned
  }
  
  // If starts with 0, remove it
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }
  
  // If it's 10 digits, add +91 prefix
  if (/^\d{10}$/.test(cleaned)) {
    return '+91' + cleaned
  }
  
  // If it's already 12 digits (91XXXXXXXXXX), add +
  if (/^\d{12}$/.test(cleaned)) {
    return '+' + cleaned
  }
  
  return cleaned.startsWith('+') ? cleaned : null
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,
  loading: true,
  fetchProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        set({ profile: null, loading: false })
        return
      }

      const rawPhone = user.phone || (user.user_metadata as Record<string, any> | null)?.phone || null
      const phoneNumber = normalizePhoneNumber(rawPhone)
      const emailValue = user.email || null

      let profile: UserProfile | null = null

      // PHONE-FIRST APPROACH: For phone-based auth, phone number is the source of truth
      if (phoneNumber) {
        // First, check if profile with auth user ID already exists
        const { data: existingByAuthId } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        // Look up profile by phone number
        const { data: phoneProfile, error: phoneError } = await supabase
          .from('users')
          .select('*')
          .eq('phone', phoneNumber)
          .maybeSingle()

        if (phoneError && phoneError.code !== 'PGRST116') {
          console.error('Error fetching profile by phone:', phoneError)
          // Don't throw - continue with existingByAuthId if available
        }

        if (phoneProfile && phoneProfile.id !== user.id) {
          // Found profile by phone with different ID - migrate data to auth user ID profile
          const updateData = {
            email: emailValue || phoneProfile.email,
            phone: phoneNumber,
            role: phoneProfile.role,
            full_name: phoneProfile.full_name,
            rider_id: phoneProfile.rider_id,
            asm_id: phoneProfile.asm_id,
            sm_id: phoneProfile.sm_id,
            store_id: phoneProfile.store_id,
          }

          if (existingByAuthId) {
            // Profile with auth user ID exists - update it with correct data from phone profile
            const { data: updated, error: updateError } = await supabase
              .from('users')
              .update(updateData)
              .eq('id', user.id)
              .select('*')
              .single()

            if (updateError) {
              console.error('Error updating profile:', updateError)
              // If UPDATE fails, try to fetch the profile again (might have been updated by another process)
              const { data: fetched } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single()
              
              if (fetched) {
                // If fetched profile has correct role, use it; otherwise use phoneProfile data
                if (fetched.role === phoneProfile.role && fetched.asm_id === phoneProfile.asm_id) {
                  profile = fetched as UserProfile
                } else {
                  // Use phoneProfile data directly (it has the correct role)
                  profile = phoneProfile as UserProfile
                  console.warn('Profile update failed, using phone profile data:', phoneProfile)
                }
              } else {
                // Fallback: use phoneProfile data (it has the correct role)
                profile = phoneProfile as UserProfile
                console.warn('Could not fetch profile, using phone profile data:', phoneProfile)
              }
            } else {
              profile = updated as UserProfile
            }
          } else {
            // No profile with auth user ID - create new one with correct data
            const { data: created, error: createError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                ...updateData,
              })
              .select('*')
              .single()

            if (createError) {
              // If insert fails (conflict), profile was created - fetch it
              if (createError.code === '23505') {
                const { data: fetched } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', user.id)
                  .single()
                if (fetched) {
                  profile = fetched as UserProfile
                } else {
                  throw createError
                }
              } else {
                throw createError
              }
            } else {
              profile = created as UserProfile
            }
          }

          // Try to delete the old profile (by phone with different ID)
          await supabase
            .from('users')
            .delete()
            .eq('phone', phoneNumber)
            .neq('id', user.id)
        } else if (phoneProfile && phoneProfile.id === user.id) {
          // Profile found by phone and ID matches - use it
          profile = phoneProfile as UserProfile

          // Ensure phone format is normalized
          if (profile.phone !== phoneNumber) {
            const { data: updated } = await supabase
              .from('users')
              .update({ phone: phoneNumber })
              .eq('id', user.id)
              .select('*')
              .single()
            if (updated) profile = updated as UserProfile
          }
        } else if (existingByAuthId) {
          // No profile by phone, but profile with auth user ID exists
          // Check if this phone number should have ASM role (known ASM phone numbers)
          const knownASMPhones: Record<string, { role: 'asm', asm_id: string, full_name: string }> = {
            '+918980226979': { role: 'asm', asm_id: 'ASM-002', full_name: 'ASM Phone User' },
            '8980226979': { role: 'asm', asm_id: 'ASM-002', full_name: 'ASM Phone User' },
          }

          const asmData = knownASMPhones[phoneNumber] || knownASMPhones[phoneNumber.replace('+91', '')]
          
          if (asmData) {
            // Update the existing profile with correct ASM role (regardless of current role)
            const { data: updated, error: updateError } = await supabase
              .from('users')
              .update({
                phone: phoneNumber,
                role: asmData.role,
                asm_id: asmData.asm_id,
                full_name: asmData.full_name || existingByAuthId.full_name,
              })
              .eq('id', user.id)
              .select('*')
              .single()

            if (updateError) {
              console.error('Error updating profile with ASM role:', updateError)
              profile = existingByAuthId as UserProfile
            } else {
              profile = updated as UserProfile
            }
          } else {
            // Unknown phone number - don't allow login
            console.error('Unknown phone number for existing profile:', phoneNumber)
            throw new Error(`Phone number ${phoneNumber} is not registered. Please contact administrator.`)
          }
        } else {
          // No profile found anywhere - check if this is a known phone number
          const knownASMPhones: Record<string, { role: 'asm', asm_id: string, full_name: string }> = {
            '+918980226979': { role: 'asm', asm_id: 'ASM-002', full_name: 'ASM Phone User' },
            '8980226979': { role: 'asm', asm_id: 'ASM-002', full_name: 'ASM Phone User' },
          }

          const asmData = knownASMPhones[phoneNumber] || knownASMPhones[phoneNumber.replace('+91', '')]
          
          if (asmData) {
            // Create profile with ASM role for known phone number
            const { data: inserted, error: insertError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: emailValue,
                phone: phoneNumber,
                full_name: asmData.full_name,
                role: asmData.role,
                asm_id: asmData.asm_id,
                rider_id: null,
                sm_id: null,
                store_id: null,
              })
              .select('*')
              .single()

            if (insertError) {
              // If insert fails (conflict), profile was created - fetch it
              if (insertError.code === '23505') {
                const { data: fetched } = await supabase
                  .from('users')
                  .select('*')
                  .eq('id', user.id)
                  .single()
                if (fetched) {
                  profile = fetched as UserProfile
                } else {
                  throw insertError
                }
              } else {
                throw insertError
              }
            } else {
              profile = inserted as UserProfile
            }
          } else {
            // Unknown phone number - don't create a profile, throw error
            console.error('No profile found for phone number:', phoneNumber)
            throw new Error(`No profile found for phone number ${phoneNumber}. Please contact administrator.`)
          }
        }
      } else if (emailValue) {
        // EMAIL-FALLBACK: For email-based auth, use ID lookup
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          profile = data as UserProfile
        } else {
          // No profile found for email user - don't auto-create viewer profile
          // User must be registered in the system first
          throw new Error(`No profile found for email ${emailValue}. Please contact administrator.`)
        }
      } else {
        // No phone or email - cannot create profile
        console.error('User has neither phone nor email')
        set({ profile: null, loading: false })
        return
      }

      if (profile) {
        // Ensure profile data is complete
        const resolvedProfile: UserProfile = {
          ...profile,
          role: profile.role || 'viewer',
          full_name: profile.full_name || profile.phone || profile.email || 'User',
          phone: profile.phone || phoneNumber || null,
        }
        set({ profile: resolvedProfile, loading: false })
      } else {
        set({ profile: null, loading: false })
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      set({ profile: null, loading: false })
    }
  },
}))
