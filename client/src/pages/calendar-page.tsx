import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Family, FamilyMember, CalendarEvent } from "@shared/schema";

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    location: "",
  });

  const { data: familyData } = useQuery<{ family: Family; members: FamilyMember[] }>({
    queryKey: ["/api/family"],
  });

  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar"],
  });

  const createEvent = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/calendar", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setDialogOpen(false);
      setNewEvent({ title: "", description: "", startDate: "", endDate: "", location: "" });
    },
  });

  const family = familyData?.family;
  const members = familyData?.members || [];

  const handleSubmit = () => {
    if (!family || !newEvent.title || !newEvent.startDate) return;
    createEvent.mutate({
      familyId: family.id,
      title: newEvent.title,
      description: newEvent.description || null,
      startDate: new Date(newEvent.startDate).toISOString(),
      endDate: newEvent.endDate ? new Date(newEvent.endDate).toISOString() : null,
      location: newEvent.location || null,
      memberIds: null,
      source: "manual",
    });
  };

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDay = (date: Date) => {
    return (events || []).filter((e) => {
      const eDate = parseISO(e.startDate);
      return isSameDay(eDate, date);
    });
  };

  const upcomingEvents = (events || [])
    .filter((e) => parseISO(e.startDate) >= new Date())
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime())
    .slice(0, 8);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto" data-testid="calendar-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold">Calendar</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-event">
              <Plus className="h-4 w-4 mr-1" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Title</Label>
                <Input
                  value={newEvent.title}
                  onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Event title"
                  data-testid="input-event-title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  data-testid="input-event-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent((p) => ({ ...p, startDate: e.target.value }))}
                    data-testid="input-event-start"
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.endDate}
                    onChange={(e) => setNewEvent((p) => ({ ...p, endDate: e.target.value }))}
                    data-testid="input-event-end"
                  />
                </div>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={newEvent.location}
                  onChange={(e) => setNewEvent((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Optional location"
                  data-testid="input-event-location"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createEvent.isPending || !newEvent.title || !newEvent.startDate}
                className="w-full"
                data-testid="button-submit-event"
              >
                {createEvent.isPending ? "Adding..." : "Add Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="pt-4 pb-2 px-3">
          <div className="flex items-center justify-between mb-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {days.map((d, idx) => {
              const dayEvents = getEventsForDay(d);
              const inMonth = isSameMonth(d, currentMonth);
              const today_ = isToday(d);
              return (
                <div
                  key={idx}
                  className={`min-h-[48px] p-1 text-center border-t border-border/50 ${
                    !inMonth ? "opacity-30" : ""
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${
                      today_
                        ? "bg-primary text-primary-foreground font-bold"
                        : "font-medium"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-[9px] bg-primary/10 text-primary rounded px-1 mt-0.5 truncate"
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-muted-foreground">+{dayEvents.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming events */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Upcoming Events
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events. Add one!</p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((ev) => {
              const eventMembers = ev.memberIds
                ? JSON.parse(ev.memberIds).map((id: number) =>
                    members.find((m) => m.id === id)
                  ).filter(Boolean)
                : [];
              return (
                <Card key={ev.id} data-testid={`event-card-${ev.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{ev.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(ev.startDate), "EEE, MMM d 'at' h:mm a")}
                        </p>
                        {ev.location && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {ev.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {eventMembers.map((m: FamilyMember) => (
                          <span key={m.id} title={m.name} className="text-sm">
                            {m.emoji}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
