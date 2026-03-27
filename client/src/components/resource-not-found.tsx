import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileX } from "lucide-react";

interface ResourceNotFoundProps {
  title?: string;
  message?: string;
  backTo?: string;
  backLabel?: string;
}

export function ResourceNotFound({
  title = "Not found",
  message = "This item no longer exists or may have been removed.",
  backTo = "/",
  backLabel = "Go Home",
}: ResourceNotFoundProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center">
          <FileX className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-lg font-semibold mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <Link href={backTo}>
            <Button data-testid="button-resource-not-found-back">
              {backLabel}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
