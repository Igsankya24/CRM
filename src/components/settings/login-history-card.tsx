'use client';

import { useState, useEffect } from 'react';
import { History, Loader2, Monitor, Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UserLoginLog {
  id: string;
  user_id: string;
  login_time: string | null;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
}

export function LoginHistoryCard() {
  const { user } = useAuth();
  const supabase = createClient();
  const [logs, setLogs] = useState<UserLoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('user_login_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('login_time', { ascending: false })
          .limit(10);

        if (error) {
          throw error;
        }
        setLogs((data as unknown as UserLoginLog[]) || []);
      } catch (err) {
        console.error('Error fetching login logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [user, supabase]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    return new Date(timeStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <History className="size-4 text-primary" />
          Login History
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Monitor your active and recent sessions. If you spot unfamiliar activity, change your password immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/10 text-muted-foreground text-sm">
            No login history recorded yet.
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-muted-foreground">Login Time</TableHead>
                  <TableHead className="text-muted-foreground">IP Address</TableHead>
                  <TableHead className="text-muted-foreground">Device / Browser</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/10 border-border">
                    <TableCell className="font-medium text-foreground whitespace-nowrap">
                      {formatTime(log.login_time)}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <Globe className="size-3" />
                        {log.ip_address || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <Monitor className="size-3 shrink-0" />
                        {log.device || 'Unknown Device'} • {log.browser || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                        Success
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
