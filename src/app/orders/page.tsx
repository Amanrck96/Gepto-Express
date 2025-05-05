
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Package } from 'lucide-react';

export default function OrdersPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" /> My Orders
          </CardTitle>
          <CardDescription>
            View your past orders and track current ones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12">
            <p>Order history feature is coming soon!</p>
            <p className="text-sm mt-2">(Requires user login)</p>
          </div>
          {/* Placeholder for order list */}
          {/*
          <div className="space-y-4">
             Map through orders here when data is available
            <Card>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">Order #GEPTO-12345</p>
                  <p className="text-sm text-muted-foreground">Placed on: May 5, 2024</p>
                  <p className="text-sm text-muted-foreground">Status: Delivered</p>
                </div>
                <div>
                  <p className="font-semibold">₹250.00</p>
                   <Button variant="outline" size="sm" className="mt-1">View Details</Button>
                </div>
              </CardContent>
            </Card>
          </div>
          */}
        </CardContent>
      </Card>
    </div>
  );
}
