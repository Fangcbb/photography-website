import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ApertureSelector } from "../../aperture-selector";
import { ShutterSpeedSelector } from "../../shutter-speed-selector";
import { ISOSelector } from "../../iso-selector";
import { ExposureCompensationSelector } from "../../exposure-compensation-selector";
import { secondStepSchema, SecondStepData, MetadataStepProps } from "../types";

export function SecondStep({
  exif,
  onNext,
  onBack,
  initialData,
  isSubmitting,
}: MetadataStepProps) {
  const form = useForm<SecondStepData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(secondStepSchema) as any,
    defaultValues: {
      title: initialData?.title ?? "",
      description: initialData?.description ?? "",
      visibility: initialData?.visibility ?? "private",
      isFavorite: initialData?.isFavorite ?? false,
      make: initialData?.make ?? "",
      model: initialData?.model ?? "",
      lensModel: initialData?.lensModel ?? "",
      focalLength: initialData?.focalLength ?? ("" as any),
      focalLength35mm: initialData?.focalLength35mm ?? ("" as any),
      fNumber: initialData?.fNumber ?? ("" as any),
      iso: initialData?.iso ?? ("" as any),
      exposureTime: initialData?.exposureTime ?? ("" as any),
      exposureCompensation: initialData?.exposureCompensation ?? ("" as any),
      latitude: initialData?.latitude ?? ("" as any),
      longitude: initialData?.longitude ?? ("" as any),
    } as Partial<SecondStepData> & Record<string, any>,
    mode: "onChange",
  });

  const { handleSubmit, formState } = form;
  const { isValid } = formState;
  
  // Manual validation for required fields (title and description)
  const titleValue = form.watch("title");
  const descriptionValue = form.watch("description");
  const manualIsValid = titleValue && titleValue.length > 0 && descriptionValue && descriptionValue.length > 0;

  const onSubmit = (data: SecondStepData) => {
    onNext(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="照片标题" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>可见性</FormLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {field.value === "public" ? "公开" : "私密"}
                      </span>
                      <FormControl>
                        <Switch
                          checked={field.value === "public"}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? "public" : "private")
                          }
                        />
                      </FormControl>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      className="resize-none"
                      placeholder="照片描述"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Camera Parameters Section */}
            <div className="space-y-4 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">拍摄参数</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {exif
                    ? "已从 EXIF 自动填充，可手动修改。"
                    : "未找到 EXIF 信息，请手动填写。"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>相机品牌</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Canon" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>相机型号</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., EOS R5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="lensModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>镜头型号</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., RF 24-70mm f/2.8L" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="focalLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Focal Length (mm)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          placeholder="50"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            field.onChange(val);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="focalLength35mm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>35mm Equivalent (mm)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          placeholder="50"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value
                              ? parseFloat(e.target.value)
                              : undefined;
                            field.onChange(val);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="fNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>光圈</FormLabel>
                      <FormControl>
                        <ApertureSelector
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exposureTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>快门速度</FormLabel>
                      <FormControl>
                        <ShutterSpeedSelector
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="iso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ISO</FormLabel>
                      <FormControl>
                        <ISOSelector
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="exposureCompensation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>EV</FormLabel>
                      <FormControl>
                        <ExposureCompensationSelector
                          value={field.value ?? undefined}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />返回</Button>
          <Button type="submit" disabled={isSubmitting || !(isValid || manualIsValid)}>下一步<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
