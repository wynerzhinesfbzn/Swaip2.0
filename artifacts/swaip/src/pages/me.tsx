import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useGetAccount, useUpdateAccount, getGetAccountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, GitBranch, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PushStatus = { ok: boolean; message: string } | null;

export default function Me() {
  const { hash, mode } = useAuth();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [pushing, setPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>(null);

  const { data: account, isLoading } = useGetAccount(
    hash,
    { query: { queryKey: getGetAccountQueryKey(hash), enabled: !!hash } }
  );

  const updateMutation = useUpdateAccount({
    request: { headers: { "x-user-hash": hash } }
  });

  useEffect(() => {
    if (account) {
      const user = account.data || account as any;
      setName(user.name || "");
      setHandle(user.handle || "");
      setBio(user.bio || "");
      setAvatar(user.avatar || "");
    }
  }, [account]);

  const handleSave = () => {
    updateMutation.mutate({
      hash,
      data: { data: { name, handle, bio, avatar, mode } }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(hash) });
      }
    });
  };

  const handleGitPush = async () => {
    setPushing(true);
    setPushStatus(null);
    try {
      const res = await fetch(`${window.location.origin}/api/git-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `chore: update ${new Date().toISOString()}` }),
      });
      const data = await res.json();
      if (data.success) {
        const detail = data.hasChanges
          ? `Committed & pushed. ${data.push}`
          : `Nothing to commit. ${data.push}`;
        setPushStatus({ ok: true, message: detail });
      } else {
        setPushStatus({ ok: false, message: data.error || "Push failed." });
      }
    } catch (e: any) {
      setPushStatus({ ok: false, message: e?.message || "Network error." });
    } finally {
      setPushing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isScene = mode === 'scene';

  return (
    <div className="flex flex-col min-h-full p-4 max-w-md mx-auto">
      <div className="mb-8 mt-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Edit Persona</h1>
        <p className="text-sm text-muted-foreground">
          Currently editing <span className={`font-bold ${isScene ? 'text-secondary' : 'text-primary'}`}>{mode.toUpperCase()}</span> mode
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-4 mb-2">
          <Avatar className={`w-24 h-24 border-2 ${isScene ? 'border-secondary' : 'border-primary/50'}`}>
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className="bg-black text-2xl font-bold">{name?.charAt(0) || "?"}</AvatarFallback>
          </Avatar>
          <div className="w-full">
            <Label className="text-xs text-muted-foreground mb-1.5 block text-center">Avatar URL</Label>
            <Input 
              value={avatar} 
              onChange={(e) => setAvatar(e.target.value)} 
              placeholder="https://..."
              className="bg-black/50 border-white/10 text-center"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-muted-foreground">Display Name</Label>
            <Input 
              id="name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder={isScene ? "Your stage name" : "Your real name"}
              className="bg-black/50 border-white/10 focus-visible:ring-primary h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="handle" className="text-muted-foreground">Handle</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input 
                id="handle"
                value={handle} 
                onChange={(e) => setHandle(e.target.value)} 
                placeholder="username"
                className="pl-8 bg-black/50 border-white/10 focus-visible:ring-primary h-12 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio" className="text-muted-foreground">Bio</Label>
            <Textarea 
              id="bio"
              value={bio} 
              onChange={(e) => setBio(e.target.value)} 
              placeholder="Tell the world..."
              className="bg-black/50 border-white/10 focus-visible:ring-primary min-h-[100px] resize-none"
            />
          </div>
        </div>

        <Button 
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className={`w-full mt-4 h-12 font-bold text-lg rounded-full ${isScene ? 'bg-secondary hover:bg-secondary/80 text-white' : 'bg-primary hover:bg-primary/80 text-black'}`}
        >
          {updateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Save Persona
        </Button>
        
        <div className="text-center mt-6 text-xs text-muted-foreground font-mono">
          Your Identity Hash: <br/>
          <span className="text-foreground/50 select-all break-all">{hash}</span>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-xs text-muted-foreground text-center mb-3 font-mono uppercase tracking-widest">
            Developer Tools
          </p>
          <Button
            onClick={handleGitPush}
            disabled={pushing}
            variant="outline"
            className="w-full h-11 font-mono text-sm border-white/20 hover:bg-white/5 hover:border-white/40"
          >
            {pushing
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <GitBranch className="w-4 h-4 mr-2" />
            }
            {pushing ? "Pushing to GitHub…" : "Push to GitHub"}
          </Button>

          {pushStatus && (
            <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs font-mono ${pushStatus.ok ? "bg-green-950/60 text-green-300 border border-green-800/40" : "bg-red-950/60 text-red-300 border border-red-800/40"}`}>
              {pushStatus.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              }
              <span className="break-all">{pushStatus.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
