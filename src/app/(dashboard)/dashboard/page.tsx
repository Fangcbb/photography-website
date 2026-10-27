import { OverviewView } from "@/modules/dashboard/ui/views/overview-view";

const page = async () => {
  return (
    <div className="py-4 px-4 md:px-8 flex flex-col">
      <div>
        <h1 className="text-2xl font-bold">总览</h1>
        <p className="text-muted-foreground ">
          查看你的照片、旅行记录等内容。
        </p>
      </div>
      <div className="@container/main flex flex-1 flex-col">
        <OverviewView />
      </div>
    </div>
  );
};

export default page;
