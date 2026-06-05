import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationList } from "@/components/ui/notification-list";

export function SimplePageRoute({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader description={description} title={title} />
      <Card>
        <CardHeader>
          <CardTitle>{title} foundation</CardTitle>
          <CardDescription>
            This route is ready for its later implementation slice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationList />
        </CardContent>
      </Card>
    </div>
  );
}
