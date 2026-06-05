"use client";

import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { IconPlus, IconTrash } from "@tabler/icons-react";

interface GearItem {
  brand: string;
  model: string;
}

export default function AboutDashboardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    trpc.about.get.queryOptions()
  );

  const updateMutation = useMutation(
    trpc.about.update.mutationOptions({
      onSuccess: () => {
        toast.success("About content saved");
        queryClient.invalidateQueries(trpc.about.get.queryOptions());
      },
      onError: (err) => {
        toast.error(`Save failed: ${err.message}`);
      },
    })
  );

  // Form state
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [aboutHeading, setAboutHeading] = useState("");
  const [aboutParagraphs, setAboutParagraphs] = useState<string[]>([]);
  const [cameraHeading, setCameraHeading] = useState("");
  const [cameraSubheading, setCameraSubheading] = useState("");
  const [cameraDescription, setCameraDescription] = useState("");
  const [gear, setGear] = useState<GearItem[]>([]);

  // Load data into form
  useEffect(() => {
    if (data) {
      setName(data.name ?? "");
      setRole(data.role ?? "");
      setBio(data.bio ?? "");
      setAboutHeading(data.aboutHeading ?? "About");
      setAboutParagraphs(
        Array.isArray(data.aboutParagraphs) ? data.aboutParagraphs : []
      );
      setCameraHeading(data.cameraHeading ?? "Camera");
      setCameraSubheading(data.cameraSubheading ?? "Camera Lenses");
      setCameraDescription(data.cameraDescription ?? "");
      try {
        setGear(JSON.parse(data.gear ?? "[]"));
      } catch {
        setGear([]);
      }
    }
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate({
      name,
      role,
      bio,
      aboutHeading,
      aboutParagraphs,
      cameraHeading,
      cameraSubheading,
      cameraDescription,
      gear: JSON.stringify(gear),
    });
  };

  const updateParagraph = (index: number, value: string) => {
    const next = [...aboutParagraphs];
    next[index] = value;
    setAboutParagraphs(next);
  };

  const addParagraph = () => {
    setAboutParagraphs([...aboutParagraphs, ""]);
  };

  const removeParagraph = (index: number) => {
    setAboutParagraphs(aboutParagraphs.filter((_, i) => i !== index));
  };

  const updateGear = (index: number, field: "brand" | "model", value: string) => {
    const next = [...gear];
    next[index] = { ...next[index], [field]: value };
    setGear(next);
  };

  const addGear = () => {
    setGear([...gear, { brand: "", model: "" }]);
  };

  const removeGear = (index: number) => {
    setGear(gear.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="py-4 px-4 md:px-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="py-4 px-4 md:px-8 flex flex-col gap-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">About Page</h1>
        <p className="text-sm text-muted-foreground">
          Edit the content shown on the /about page
        </p>
      </div>

      {/* Profile Section */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Bio</Label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* About Card Section */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">About Card</h2>
        <div className="flex flex-col gap-2">
          <Label>Heading</Label>
          <Input
            value={aboutHeading}
            onChange={(e) => setAboutHeading(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Paragraphs</Label>
            <Button variant="outline" size="sm" onClick={addParagraph}>
              <IconPlus className="size-4 mr-1" />
              Add
            </Button>
          </div>
          {aboutParagraphs.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Textarea
                value={p}
                onChange={(e) => updateParagraph(i, e.target.value)}
                rows={3}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeParagraph(i)}
              >
                <IconTrash className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Camera Card Section */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Camera Card</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Heading</Label>
            <Input
              value={cameraHeading}
              onChange={(e) => setCameraHeading(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Subheading</Label>
            <Input
              value={cameraSubheading}
              onChange={(e) => setCameraSubheading(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Description</Label>
          <Textarea
            value={cameraDescription}
            onChange={(e) => setCameraDescription(e.target.value)}
            rows={3}
          />
        </div>
      </section>

      {/* Gear Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Gear List</h2>
          <Button variant="outline" size="sm" onClick={addGear}>
            <IconPlus className="size-4 mr-1" />
            Add
          </Button>
        </div>
        {gear.map((item, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex flex-col gap-2 w-1/3">
              {i === 0 && <Label>Brand</Label>}
              <Input
                value={item.brand}
                onChange={(e) => updateGear(i, "brand", e.target.value)}
                placeholder="NIKON"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              {i === 0 && <Label>Model</Label>}
              <Input
                value={item.model}
                onChange={(e) => updateGear(i, "model", e.target.value)}
                placeholder="Z8 / Z63"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeGear(i)}
            >
              <IconTrash className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </section>

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="min-w-32"
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
