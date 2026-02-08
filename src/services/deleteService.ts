import { supabase } from '../lib/supabase';

export async function archiveAgent(agentId: string): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({
      status: 'INACTIVE',
      archived_at: new Date().toISOString()
    })
    .eq('id', agentId);

  if (error) {
    throw new Error(error.message || 'Failed to archive agent');
  }
}

export async function deleteAdvance(advanceId: string): Promise<void> {
  const { error } = await supabase
    .from('cash_advances')
    .delete()
    .eq('id', advanceId);

  if (error) {
    throw new Error(error.message || 'Failed to delete advance');
  }
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const { error } = await supabase
    .from('fruit_collections')
    .delete()
    .eq('id', collectionId);

  if (error) {
    throw new Error(error.message || 'Failed to delete collection');
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_expenses')
    .delete()
    .eq('id', expenseId);

  if (error) {
    throw new Error(error.message || 'Failed to delete expense');
  }
}
