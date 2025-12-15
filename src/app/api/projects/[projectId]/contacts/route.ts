import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

interface CreateContactRequest {
  name: string;
  email?: string;
  avatar_url?: string;
}

// GET - List all contacts for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to this project (member or admin)
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (!membership && profile?.global_role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch contacts for this project
    const { data: contacts, error } = await supabase
      .from('project_contacts')
      .select('*')
      .eq('project_id', projectId)
      .order('name', { ascending: true });

    if (error) {
      log.error('Failed to fetch project contacts', { projectId, error: error.message });
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }

    return NextResponse.json({ contacts });
  } catch (error) {
    log.error('Unexpected error fetching project contacts', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new contact for a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;

    log.info('Creating project contact', { projectId });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's role
    const { data: profile } = await supabase
      .from('profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.global_role === 'admin';
    const isProgramManager = profile?.global_role === 'program_manager';

    // Check project membership
    const { data: membership } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    // Authorization: Admin can add to any project, Program Manager can add to their projects
    if (!isAdmin && !(isProgramManager && membership)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Program Manager access required' }, { status: 403 });
    }

    // Validate request body
    const body: CreateContactRequest = await request.json();
    const { name, email, avatar_url } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate email format if provided
    if (email && typeof email === 'string' && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    const serviceSupabase = createServiceClient();

    // Check if project exists
    const { data: project, error: projectError } = await serviceSupabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if contact with same email already exists on this project
    if (email && email.trim()) {
      const { data: existingContact } = await serviceSupabase
        .from('project_contacts')
        .select('id')
        .eq('project_id', projectId)
        .eq('email', email.trim().toLowerCase())
        .single();

      if (existingContact) {
        return NextResponse.json({ error: 'A contact with this email already exists on this project' }, { status: 409 });
      }
    }

    // Create the contact
    const { data: contact, error: createError } = await serviceSupabase
      .from('project_contacts')
      .insert({
        project_id: projectId,
        name: name.trim(),
        email: email?.trim().toLowerCase() || null,
        avatar_url: avatar_url?.trim() || null,
      })
      .select()
      .single();

    if (createError) {
      log.error('Failed to create project contact', { projectId, error: createError.message });
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
    }

    log.info('Project contact created', { projectId, contactId: contact.id });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    log.error('Unexpected error creating project contact', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
