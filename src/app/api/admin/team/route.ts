import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

// GET - Get all projects with their team members and contacts (admin only)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      log.error('Failed to fetch user profile', { userId: user.id, error: profileError?.message });
      return NextResponse.json({ error: 'Failed to verify user permissions' }, { status: 500 });
    }

    if (profile.global_role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();

    // Fetch all projects
    const { data: projects, error: projectsError } = await serviceSupabase
      .from('projects')
      .select('id, name, description, created_at')
      .order('name', { ascending: true });

    if (projectsError) {
      log.error('Failed to fetch projects for admin team overview', { error: projectsError.message });
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Fetch all project members with profiles
    const { data: members, error: membersError } = await serviceSupabase
      .from('project_members')
      .select(`
        project_id,
        user_id,
        project_role,
        created_at,
        profile:profiles (
          id,
          email,
          full_name,
          avatar_url,
          global_role
        )
      `);

    if (membersError) {
      log.error('Failed to fetch project members for admin team overview', { error: membersError.message });
      return NextResponse.json({ error: 'Failed to fetch project members' }, { status: 500 });
    }

    // Fetch all project contacts
    const { data: contacts, error: contactsError } = await serviceSupabase
      .from('project_contacts')
      .select('*')
      .order('name', { ascending: true });

    if (contactsError) {
      log.error('Failed to fetch project contacts for admin team overview', { error: contactsError.message });
      return NextResponse.json({ error: 'Failed to fetch project contacts' }, { status: 500 });
    }

    // Pre-group members and contacts by project_id using Maps for O(1) lookup
    const membersByProject = new Map<string, typeof members>();
    members?.forEach(m => {
      const existing = membersByProject.get(m.project_id) || [];
      existing.push(m);
      membersByProject.set(m.project_id, existing);
    });

    const contactsByProject = new Map<string, typeof contacts>();
    contacts?.forEach(c => {
      const existing = contactsByProject.get(c.project_id) || [];
      existing.push(c);
      contactsByProject.set(c.project_id, existing);
    });

    // Build project teams with O(1) lookups instead of O(n) filters
    const projectTeams = projects?.map(project => {
      const projectMembers = membersByProject.get(project.id) || [];
      const projectContacts = contactsByProject.get(project.id) || [];

      return {
        ...project,
        members: projectMembers.map(m => ({
          id: m.user_id,
          project_role: m.project_role,
          created_at: m.created_at,
          profile: m.profile,
        })),
        contacts: projectContacts,
        member_count: projectMembers.length,
        contact_count: projectContacts.length,
      };
    }) || [];

    return NextResponse.json({ projects: projectTeams });
  } catch (error) {
    log.error('Unexpected error in admin team overview', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
