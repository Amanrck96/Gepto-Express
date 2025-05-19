
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListPlus, ShoppingBag, Users, BarChart3 } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <CardHeader className="px-0 pb-4">
        <CardTitle className="text-3xl font-bold">Admin Dashboard</CardTitle>
        <CardDescription>Manage your Gepto Express application.</CardDescription>
      </CardHeader>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              Product Management
            </CardTitle>
            <CardDescription>Add, edit, and manage products and categories.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/products">Go to Products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-50 cursor-not-allowed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListPlus className="h-6 w-6" />
              Order Management
            </CardTitle>
            <CardDescription>View and manage customer orders. (Coming Soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">Manage Orders</Button>
          </CardContent>
        </Card>

        <Card className="opacity-50 cursor-not-allowed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6" />
              User Management
            </CardTitle>
            <CardDescription>Manage user accounts and roles. (Coming Soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">Manage Users</Button>
          </CardContent>
        </Card>
        
        <Card className="opacity-50 cursor-not-allowed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Analytics
            </CardTitle>
            <CardDescription>View sales reports and app analytics. (Coming Soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">View Analytics</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
