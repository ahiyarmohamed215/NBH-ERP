import {useEffect} from 'react';
import {useAuth} from './AuthContext';
import {clearApiCache, refreshSession, getAccessToken} from '../api/apiClient';
import {createRealtimeClient} from '../api/realtimeClient';

const topicEvents = {
  orders:['purchasing'], suppliers:['purchasing'], grn:['purchasing','inventory'],
  gtn:['purchasing','inventory'], prn:['purchasing','inventory'], inventory:['inventory'],
  sales:['sales','inventory','targets'], quotations:['sales'], payments:['sales','customers'],
  returns:['sales','inventory','customers'],
  customers:['customers'], targets:['targets','customers'], delivery:['delivery'], users:['users'], roles:['roles'],
  dashboard:[], reports:[], audit:[],
};
export function invalidateRealtime(topics) {
  const accepted = topics?.filter(topic => Object.hasOwn(topicEvents, topic)) ?? null;
  if (accepted && !accepted.length) return;
  clearApiCache();
  window.dispatchEvent(new CustomEvent('erp:realtime_sync', {detail:{topics:accepted, remote:true}}));
  const names = new Set((accepted || []).flatMap(topic => topicEvents[topic]));
  for (const name of names) window.dispatchEvent(new CustomEvent(`erp:${name}_updated`, {detail:{topics:accepted, remote:true}}));
}
export default function RealtimeSync() {
  const {user} = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    return createRealtimeClient({
      url:`${(import.meta.env?.VITE_API_URL || '').replace(/\/$/, '')}/api/v1/events`,
      getToken: getAccessToken, refreshSession, invalidate:invalidateRealtime,
    });
  }, [user?.id]);
  return null;
}
