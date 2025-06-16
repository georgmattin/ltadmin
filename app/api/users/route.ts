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
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    
    // Get all users from Supabase
    const allUsers = await getAllUsers();
    const totalCount = allUsers.length;

    // Calculate pagination on our side
    const from = (page - 1) * pageSize;
    const to = from + pageSize;
    const paginatedUsers = allUsers.slice(from, to);

    // Fetch additional profile data for the paginated users
    const userIds = paginatedUsers.map(user => user.id);
    let profilesData = [];
    
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, eesnimi, perenimi, created_at')
        .in('id', userIds);

      if (profilesError) {
        console.warn('Error fetching profiles:', profilesError);
      } else {
        profilesData = profiles || [];
      }
    }

    // Merge auth users with profile data
    const enrichedUsers = paginatedUsers.map(user => {
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
        // Add some security info
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      };
    });

    // Return data with pagination info
    return NextResponse.json({
      data: enrichedUsers,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      }
    });
  } catch (error) {
    console.error('Error in users API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 