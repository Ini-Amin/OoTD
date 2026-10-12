import { createBrowserClient } from '@supabase/ssr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { validPerson, type Person } from './district';

export function joinPlaza(url: string, key: string, initial: Person, onPeople: (people: Person[]) => void, onStatus: (status: string) => void) {
 const client = createBrowserClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
 let current = initial;
 let connected = false;
 let closed = false;
 let lastSent = 0;
 let timer: ReturnType<typeof setTimeout> | undefined;
 let channel: RealtimeChannel;
 const publish = async () => {
  if (!connected || closed) return;
  lastSent = Date.now();
  const status = await channel.track(current);
  if (!closed && status !== 'ok') onStatus('Connection interrupted');
 };
 channel = client.channel('ootd:public-plaza:v1', { config: { presence: { key: initial.id } } })
  .on('presence', { event: 'sync' }, () => {
   const people = Object.values(channel.presenceState()).flat().map(validPerson).filter((p): p is Person => !!p);
   onPeople([...new Map(people.map(p => [p.id, p])).values()].slice(0, 100));
  })
  .subscribe((status) => {
   if (closed) return;
   connected = status === 'SUBSCRIBED';
   if (connected) { onStatus('Live'); void publish(); }
   else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { onStatus('Connection interrupted'); onPeople([]); }
  });
 return {
  update(person: Person) {
   current = person;
   if (timer) clearTimeout(timer);
   timer = setTimeout(() => { void publish(); }, Math.max(0, 300 - (Date.now() - lastSent)));
  },
  close() { closed = true; connected = false; if (timer) clearTimeout(timer); void client.removeChannel(channel); onPeople([]); }
 };
}
