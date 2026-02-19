import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      // Create user in Supabase table if they don't exist
      const { data: existingUser } = await supabase
        .from('User')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!existingUser) {
        await supabase.from('User').insert({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata.full_name,
          image: data.user.user_metadata.avatar_url,
        });
      } else {
        await supabase.from('User').update({
          email: data.user.email,
          image: data.user.user_metadata.avatar_url,
        }).eq('id', data.user.id);
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host') // hosted making the request
      const isLocalHost = origin.startsWith('http://localhost')
      if (isLocalHost) {
        // we can be sure that there is no proxy involved in localhost
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
