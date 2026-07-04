import { createClient } from '@/lib/supabase/server';
import type { Plan } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { subscriptionID, planKey } = (await req.json()) as {
      subscriptionID: string;
      planKey: Plan;
    };

    if (!subscriptionID || !planKey) {
      return Response.json({ error: 'Missing subscriptionID or planKey' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Find existing subscription for this user and update it, or insert a new one
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = existing
      ? await supabase
          .from('subscriptions')
          .update({
            plan_id:                planKey,
            status:                 'trialing',
            paypal_subscription_id: subscriptionID,
            updated_at:             new Date().toISOString(),
          })
          .eq('id', existing.id)
      : await supabase
          .from('subscriptions')
          .insert({
            user_id:                user.id,
            plan_id:                planKey,
            status:                 'trialing',
            paypal_subscription_id: subscriptionID,
          });

    if (error) {
      console.error('[paypal/subscription] upsert error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[paypal/subscription] unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
