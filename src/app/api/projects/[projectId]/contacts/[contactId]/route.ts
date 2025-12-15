import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';

const log = loggers.api;

interface UpdateContactRequest {
  name?: string;
  email?: string;
  avatar_url?: string;
}

// GET - Get a single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; contactId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId, contactId } = resolvedParams;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access to this project
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

    // Fetch the contact
    const { data: contact, error } = await supabase
      .from('project_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('project_id', projectId)
      .single();

    if (error || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    log.error('Unexpected error fetching contact', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; contactId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId, contactId } = resolvedParams;

    log.info('Updating project contact', { projectId, contactId });

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

    // Authorization
    if (!isAdmin && !(isProgramManager && membership)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Program Manager access required' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();

    // Check contact exists
    const { data: existingContact, error: existingError } = await serviceSupabase
      .from('project_contacts')
      .select('*')
      .eq('id', contactId)
      .eq('project_id', projectId)
      .single();

    if (existingError || !existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Validate request body
    const body: UpdateContactRequest = await request.json();
    const { name, email, avatar_url } = body;

    // Build update object
    const updateData: Record<string, string | null> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (email !== undefined) {
      if (email && typeof email === 'string' && email.trim().length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Check if another contact has this email
        const { data: duplicateContact } = await serviceSupabase
          .from('project_contacts')
          .select('id')
          .eq('project_id', projectId)
          .eq('email', email.trim().toLowerCase())
          .neq('id', contactId)
          .single();

        if (duplicateContact) {
          return NextResponse.json({ error: 'Another contact with this email already exists on this project' }, { status: 409 });
        }

        updateData.email = email.trim().toLowerCase();
      } else {
        updateData.email = null;
      }
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the contact
    const { data: contact, error: updateError } = await serviceSupabase
      .from('project_contacts')
      .update(updateData)
      .eq('id', contactId)
      .select()
      .single();

    if (updateError) {
      log.error('Failed to update project contact', { contactId, error: updateError.message });
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
    }

    log.info('Project contact updated', { projectId, contactId });
    return NextResponse.json({ contact });
  } catch (error) {
    log.error('Unexpected error updating project contact', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; contactId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId, contactId } = resolvedParams;

    log.info('Deleting project contact', { projectId, contactId });

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

    // Authorization
    if (!isAdmin && !(isProgramManager && membership)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Program Manager access required' }, { status: 403 });
    }

    const serviceSupabase = createServiceClient();

    // Check contact exists
    const { data: existingContact, error: existingError } = await serviceSupabase
      .from('project_contacts')
      .select('id')
      .eq('id', contactId)
      .eq('project_id', projectId)
      .single();

    if (existingError || !existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Delete the contact
    const { error: deleteError } = await serviceSupabase
      .from('project_contacts')
      .delete()
      .eq('id', contactId);

    if (deleteError) {
      log.error('Failed to delete project contact', { contactId, error: deleteError.message });
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
    }

    log.info('Project contact deleted', { projectId, contactId });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Unexpected error deleting project contact', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
