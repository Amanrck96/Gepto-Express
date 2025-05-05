
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User } from 'lucide-react';
import { Button } from "@/components/ui/button"; // Import Button

export default function ProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-6 w-6" /> Profile & Login
          </CardTitle>
          <CardDescription>
            Manage your account details and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-12 space-y-4">
            <p>User login and profile management are coming soon!</p>
             {/* Placeholder Login/Signup Buttons */}
             <div className="flex justify-center gap-4">
                 <Button disabled>Login</Button>
                 <Button variant="outline" disabled>Sign Up</Button>
             </div>
          </div>
           {/* Placeholder for profile details */}
          {/*
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                 <span className="text-muted-foreground">Name:</span>
                 <span>Test User</span>
             </div>
             <div className="flex items-center justify-between">
                 <span className="text-muted-foreground">Email:</span>
                 <span>test@gepto.example.com</span>
             </div>
              <div className="flex items-center justify-between">
                 <span className="text-muted-foreground">Phone:</span>
                 <span>+91 9876543210</span>
             </div>
             <div className="flex items-center justify-between">
                 <span className="text-muted-foreground">Gepto Coins:</span>
                 <span>100 <Coins className="h-4 w-4 inline text-yellow-500" /></span>
             </div>
              <Button className="w-full mt-4" disabled>Logout</Button>
          </div>
          */}
        </CardContent>
      </Card>
    </div>
  );
}
