import { Progress } from "@/components/ui/progress";
import { MapPin, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeocodingProgressProps {
  current: number;
  total: number;
  currentAddress?: string;
  status: 'idle' | 'processing' | 'complete' | 'error';
  successCount?: number;
  failedCount?: number;
}

export function GeocodingProgress({
  current,
  total,
  currentAddress,
  status,
  successCount = 0,
  failedCount = 0
}: GeocodingProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  if (status === 'idle') {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        {status === 'processing' && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              Geocodificando endereços...
            </span>
          </>
        )}
        {status === 'complete' && (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-green-600">
              Geocodificação concluída!
            </span>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              Erro na geocodificação
            </span>
          </>
        )}
      </div>

      <Progress value={percentage} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{current} de {total} endereços</span>
        <span>{percentage}%</span>
      </div>

      {status === 'processing' && currentAddress && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="truncate">{currentAddress}</span>
        </div>
      )}

      {status === 'complete' && (successCount > 0 || failedCount > 0) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs">
            {successCount > 0 && (
              <span className={cn(
                "flex items-center gap-1",
                "text-green-600"
              )}>
                <CheckCircle2 className="h-3 w-3" />
                {successCount} encontrados
              </span>
            )}
            {failedCount > 0 && (
              <span className={cn(
                "flex items-center gap-1",
                "text-amber-600"
              )}>
                <XCircle className="h-3 w-3" />
                {failedCount} não encontrados
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
