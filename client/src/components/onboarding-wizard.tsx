import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight,
  ChevronLeft,
  X,
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

function ConstellationMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      style={{ color: "#C4944A" }}
    >
      <circle cx="14" cy="6" r="2.5" fill="currentColor" opacity="0.9" />
      <circle cx="7" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="21" cy="12" r="2" fill="currentColor" opacity="0.7" />
      <circle cx="9" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      <circle cx="19" cy="21" r="2.2" fill="currentColor" opacity="0.8" />
      <line x1="14" y1="6" x2="7" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="14" y1="6" x2="21" y2="12" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="7" y1="12" x2="9" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="21" y1="12" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="9" y1="21" x2="19" y2="21" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
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
      emoji: null, // uses constellation mark
      title: "Welcome to MyOhana",
      subtitle: "Your family's private digital home",
    },
    {
      emoji: "👨‍👩‍👧‍👦",
      title: "Who's in your family?",
      subtitle: "Add the people who matter most",
    },
    {
      emoji: "📸",
      title: "Capture a Memory",
      subtitle: "Start building your family album",
    },
    {
      emoji: "🎉",
      title: "Your family hub is ready!",
      subtitle: "Everything is set — let's explore together",
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <Card
        className="w-full max-w-lg relative shadow-2xl border-[#C4944A]/20"
        style={{ background: "linear-gradient(135deg, #fffdf9 0%, #ffffff 100%)" }}
        data-testid="onboarding-wizard"
      >
        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 text-muted-foreground/50 hover:text-muted-foreground"
          onClick={handleDismiss}
          data-testid="button-skip-onboarding"
        >
          <X className="h-4 w-4" />
        </Button>

        <CardContent className="pt-8 pb-6 px-6">
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-7">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? "24px" : "8px",
                  backgroundColor:
                    i === step
                      ? "#C4944A"
                      : i < step
                      ? "#C4944A60"
                      : "#e5e7eb",
                }}
              />
            ))}
          </div>

          {/* Step icon and title */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center mx-auto mb-4">
              {step === 0 ? (
                <div className="w-16 h-16 rounded-full bg-[#C4944A]/10 flex items-center justify-center">
                  <ConstellationMark size={36} />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-[#C4944A]/10 flex items-center justify-center text-3xl">
                  {currentStep.emoji}
                </div>
              )}
            </div>
            <h2
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', Georgia, serif)" }}
            >
              {currentStep.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
          </div>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {family ? (
                  <>
                    Welcome,{" "}
                    <strong className="text-foreground">{family.name}</strong>!{" "}
                    MyOhana is your family's private space — messages, photos, memories, and more.
                  </>
                ) : (
                  <>
                    MyOhana is your family's private space to share messages, photos,
                    memories, and more.
                  </>
                )}
              </p>
              <p className="text-sm text-muted-foreground/70 leading-relaxed">
                Everything stays within your family — safe, warm, and full of love. ♡
              </p>
            </div>
          )}

          {/* Step 1: Add members */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Current members */}
              {members.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                      style={{ backgroundColor: "#C4944A14" }}
                    >
                      <span className="text-sm">{m.emoji}</span>
                      <span className="text-xs font-medium">{m.name.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              {members.length === 0 && (
                <p className="text-center text-sm text-muted-foreground/60 italic">
                  Your family circle is empty — add someone you love!
                </p>
              )}

              {/* Add member form */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      value={newMember.name}
                      onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Scarlett"
                      data-testid="input-onboarding-member-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Emoji</Label>
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
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {["parent", "child", "grandparent", "other"].map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant={newMember.role === role ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewMember((p) => ({ ...p, role }))}
                        className={`capitalize text-xs ${
                          newMember.role === role
                            ? "bg-[#C4944A] hover:bg-[#A07038] text-white border-0"
                            : "border-[#C4944A]/20 hover:border-[#C4944A]/50 hover:bg-[#C4944A]/5"
                        }`}
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

          {/* Step 2: Photos */}
          {step === 2 && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Head to the <strong className="text-foreground">Photos</strong> page to upload
                your first family photo — it'll be the start of your family's digital album!
              </p>
              <p className="text-xs text-muted-foreground/60">
                You can skip this step and upload photos anytime. 🌿
              </p>
            </div>
          )}

          {/* Step 3: Completion */}
          {step === 3 && (
            <div className="text-center space-y-5">
              <div className="text-4xl">🎊</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your family hub is all set! Here's everything waiting for you:
              </p>
              <div className="grid grid-cols-2 gap-2 text-left">
                {[
                  { label: "💬 Messages", desc: "Send family notes" },
                  { label: "📸 Photos", desc: "Share memories" },
                  { label: "📅 Calendar", desc: "Plan together" },
                  { label: "🗂️ Vault", desc: "Store documents" },
                  { label: "💛 Thinking of You", desc: "Send love pulses" },
                  { label: "✨ Memories", desc: "Relive moments" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg p-2.5"
                    style={{ backgroundColor: "#C4944A0D" }}
                  >
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#C4944A]/10">
            <div>
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="text-muted-foreground">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step < 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-muted-foreground/60 hover:text-muted-foreground text-xs"
                >
                  Skip setup
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="bg-[#C4944A] hover:bg-[#A07038] text-white border-0"
                data-testid="button-onboarding-next"
              >
                {step === 3 ? "Let's go! 🏡" : "Next"}
                {step < 3 && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
