import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Camera,
  PartyPopper,
  ChevronRight,
  ChevronLeft,
  X,
  Heart,
} from "lucide-react";
import type { Family, FamilyMember } from "@shared/schema";

const STORAGE_KEY = "myohana_onboarded";

export function useOnboarding() {
  const isOnboarded = localStorage.getItem(STORAGE_KEY) === "true";
  const markOnboarded = () => localStorage.setItem(STORAGE_KEY, "true");
  return { isOnboarded, markOnboarded };
}

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const { toast } = useToast();

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const [newMember, setNewMember] = useState({ name: "", role: "child", emoji: "" });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { name: string; role: string; emoji: string }) => {
      if (!familyData?.family) throw new Error("No family");
      const res = await apiRequest("POST", "/api/family/members", {
        familyId: familyData.family.id,
        name: data.name,
        role: data.role,
        emoji: data.emoji || "👤",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      setNewMember({ name: "", role: "child", emoji: "" });
      toast({ title: "Member added!" });
    },
  });

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleDismiss();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const family = familyData?.family;
  const members = familyData?.members || [];

  const steps = [
    {
      icon: Heart,
      title: "Welcome to MyOhana!",
      subtitle: "Your family's private digital home",
    },
    {
      icon: Users,
      title: "Add Family Members",
      subtitle: "Who's in your ohana?",
    },
    {
      icon: Camera,
      title: "Share a Photo",
      subtitle: "Start building memories together",
    },
    {
      icon: PartyPopper,
      title: "You're All Set!",
      subtitle: "Your family hub is ready to explore",
    },
  ];

  const currentStep = steps[step];
  const StepIcon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg relative" data-testid="onboarding-wizard">
        {/* Skip button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 text-muted-foreground"
          onClick={handleDismiss}
          data-testid="button-skip-onboarding"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardContent className="pt-8 pb-6 px-6">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step
                    ? "bg-primary"
                    : i < step
                    ? "bg-primary/40"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step icon and title */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <StepIcon className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{currentStep.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
          </div>

          {/* Step content */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {family ? (
                  <>Welcome, <strong>{family.name}</strong>! MyOhana is your family's private space to share messages, photos, memories, and more.</>
                ) : (
                  <>MyOhana is your family's private space to share messages, photos, memories, and more.</>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Everything stays within your family — safe, secure, and full of love.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* Current members */}
              {members.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 bg-primary/5 rounded-full px-3 py-1.5">
                      <span className="text-sm">{m.emoji}</span>
                      <span className="text-xs font-medium">{m.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add member form */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={newMember.name}
                      onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Scarlett"
                      data-testid="input-onboarding-member-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Emoji</Label>
                    <Input
                      value={newMember.emoji}
                      onChange={(e) => setNewMember((p) => ({ ...p, emoji: e.target.value }))}
                      placeholder="👧"
                      className="w-16 text-center"
                      data-testid="input-onboarding-member-emoji"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Role</Label>
                  <div className="flex gap-2 mt-1">
                    {["parent", "child", "grandparent", "other"].map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant={newMember.role === role ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewMember((p) => ({ ...p, role }))}
                        className="capitalize text-xs"
                      >
                        {role}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => {
                    if (newMember.name.trim()) addMemberMutation.mutate(newMember);
                  }}
                  disabled={!newMember.name.trim() || addMemberMutation.isPending}
                  data-testid="button-onboarding-add-member"
                >
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Head to the <strong>Photos</strong> page to upload your first family photo.
                It'll be the start of your family's digital album!
              </p>
              <p className="text-xs text-muted-foreground">
                You can skip this step and upload photos anytime.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your family hub is ready! Here's what you can explore:
              </p>
              <div className="grid grid-cols-2 gap-2 text-left">
                {[
                  { label: "Messages", desc: "Send family notes" },
                  { label: "Photos", desc: "Share memories" },
                  { label: "Calendar", desc: "Plan together" },
                  { label: "Vault", desc: "Store documents" },
                  { label: "Thinking of You", desc: "Send love pulses" },
                  { label: "Memories", desc: "Relive moments" },
                ].map((item) => (
                  <div key={item.label} className="bg-primary/5 rounded-lg p-2.5">
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div>
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step < 3 && (
                <Button variant="ghost" size="sm" onClick={handleDismiss}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} data-testid="button-onboarding-next">
                {step === 3 ? "Get Started" : "Next"}
                {step < 3 && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
