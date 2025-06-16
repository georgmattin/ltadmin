import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with admin privileges
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

// Function to get all users by fetching multiple pages if needed
async function getAllUsers() {
  const allUsers = [];
  let page = 1;
  const maxPerPage = 1000; // Supabase max per page
  
  while (true) {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: maxPerPage
    });

    if (error) {
      throw error;
    }

    if (!users || users.length === 0) {
      break;
    }

    allUsers.push(...users);
    
    // If we got less than maxPerPage, we've reached the end
    if (users.length < maxPerPage) {
      break;
    }
    
    page++;
  }
  
  return allUsers;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim() === '') {
      return NextResponse.json({
        data: [],
        message: 'Search query is required'
      }, { status: 400 });
    }

    const normalizedQuery = query.trim().toLowerCase();

    // Get all users from Supabase
    const allUsers = await getAllUsers();

    // Filter users by email
    const filteredUsers = allUsers.filter(user => 
      user.email?.toLowerCase().includes(normalizedQuery)
    );

    // Get user IDs for profile lookup
    const userIds = filteredUsers.map(user => user.id);
    let profilesData = [];

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, eesnimi, perenimi, created_at')
        .or(`eesnimi.ilike.%${normalizedQuery}%,perenimi.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`)
        .in('id', userIds);

      if (profilesError) {
        console.warn('Error fetching profiles:', profilesError);
      } else {
        profilesData = profiles || [];
      }
    }

    // Also search for users by name in profiles table for users not already found
    const { data: profilesByName, error: profilesByNameError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, eesnimi, perenimi, created_at')
      .or(`eesnimi.ilike.%${normalizedQuery}%,perenimi.ilike.%${normalizedQuery}%,email.ilike.%${normalizedQuery}%`);

    if (!profilesByNameError && profilesByName) {
      const additionalUserIds = profilesByName
        .filter(profile => !userIds.includes(profile.id))
        .map(profile => profile.id);

      if (additionalUserIds.length > 0) {
        // Get auth users for these additional profiles from our allUsers array
        const matchingAdditionalUsers = allUsers.filter(user => 
          additionalUserIds.includes(user.id)
        );
        
        filteredUsers.push(...matchingAdditionalUsers);
        profilesData.push(...profilesByName.filter(profile => 
          additionalUserIds.includes(profile.id)
        ));
      }
    }

    // Merge auth users with profile data
    const enrichedUsers = filteredUsers.map(user => {
      const profile = profilesData.find(p => p.id === user.id);
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        eesnimi: profile?.eesnimi || '',
        perenimi: profile?.perenimi || '',
        profile_created_at: profile?.created_at,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      };
    });

    return NextResponse.json({
      data: enrichedUsers,
      totalCount: enrichedUsers.length,
      query: normalizedQuery
    });
  } catch (error) {
    console.error('Error in user search API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 