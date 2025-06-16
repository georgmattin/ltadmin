import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create a service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params
    const { email } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Kasutaja ID on kohustuslik' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { error: 'E-posti aadress on kohustuslik' },
        { status: 400 }
      )
    }

    // Verify that the user exists
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (userError || !user) {
      console.error('Error fetching user:', userError)
      return NextResponse.json(
        { error: 'Kasutajat ei leitud' },
        { status: 404 }
      )
    }

    // Generate magic link using Supabase admin API with provided email
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email
    })

    if (error) {
      console.error('Error generating magic link:', error)
      return NextResponse.json(
        { error: 'Magic lingi genereerimine ebaõnnestus: ' + error.message },
        { status: 500 }
      )
    }

    if (!data.properties?.action_link) {
      return NextResponse.json(
        { error: 'Magic link ei genereerunud õigesti' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      magicLink: data.properties.action_link,
      user: {
        id: user.id,
        email: email
      }
    })

  } catch (error: any) {
    console.error('Error in generate magic link API route:', error)
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    )
  }
} 