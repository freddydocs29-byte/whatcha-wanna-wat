'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabase'
import { getPreferences, savePreferences } from '@/app/lib/storage'
import { getUserId } from '@/app/lib/identity'

export default function EditProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', getUserId())
          .single()
          .then(({ data: profile }) => {
            if (profile?.display_name) setName(profile.display_name)
          })
      }
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const userId = getUserId()
    await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('user_id', userId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1C1A18] text-white px-5 pt-6 pb-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-24 right-[-60px] h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />
      </div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#2A2420] flex items-center justify-center text-white text-lg"
        >
          ←
        </button>
        <h1 className="font-display font-black text-2xl text-white">Edit Profile</h1>
      </div>

      {/* Name field */}
      <div className="mb-6">
        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-3">
          YOUR NAME
        </p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-[#2A2420] text-white font-body text-base font-medium
                     px-5 py-4 rounded-xl border border-transparent
                     placeholder:text-[#8A7F78]
                     focus:outline-none focus:border-[#E8621A]/50
                     transition-all duration-200"
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="w-full bg-[#E8621A] text-white font-display font-black text-base
                   py-4 rounded-full transition-all duration-200
                   disabled:opacity-40 disabled:pointer-events-none"
        style={{ boxShadow: '0 0 30px rgba(232,98,26,0.25)' }}
      >
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
      </button>

      {/* Preferences link */}
      <div className="mt-8">
        <p className="text-[#E8621A] text-[11px] font-semibold tracking-widest uppercase mb-3">
          FOOD PREFERENCES
        </p>
        <button
          onClick={() => router.push('/onboarding?edit=true')}
          className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 rounded-[12px] bg-[#3D3733] flex items-center justify-center text-2xl flex-shrink-0">
            🍽️
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-base text-white">Cuisines & Restrictions</p>
            <p className="font-body text-sm text-[#8A7F78] mt-0.5">Update what you like and what's off limits</p>
          </div>
          <span className="text-[#8A7F78]">→</span>
        </button>
      </div>

      {/* Danger zone */}
      <div className="mt-12">
        <p className="text-[#8A7F78] text-[11px] font-semibold tracking-widest uppercase mb-3">
          ACCOUNT
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            router.push('/')
          }}
          className="w-full bg-[#2A2420] rounded-[18px] p-4 flex items-center gap-4 text-left"
        >
          <div className="w-12 h-12 rounded-[12px] bg-red-950/50 flex items-center justify-center text-2xl flex-shrink-0">
            🚪
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-base text-red-400">Sign out</p>
            <p className="font-body text-sm text-[#8A7F78] mt-0.5">You can always come back</p>
          </div>
        </button>
      </div>
    </main>
  )
}
