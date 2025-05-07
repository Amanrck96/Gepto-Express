
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { User as UserIcon, LogIn, LogOut, Coins } from 'lucide-react'; // Added LogIn, LogOut icons
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import Image from 'next/image';
import { Skeleton } from "@/components/ui/skeleton"; // For loading state

export default function ProfilePage() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [geptoCoins, setGeptoCoins] = useState(0); // Example state, fetch from DB for logged in user

  useEffect(() => {
    if (user) {
      // TODO: Fetch user-specific Gepto Coins from Firestore or your backend
      // For now, using the static value from header as a placeholder if user is logged in.
      setGeptoCoins(100); 
    } else {
      setGeptoCoins(0);
    }
  }, [user]);


  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-6 w-6" /> Profile
            </CardTitle>
            <CardDescription>Loading profile information...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-6 w-6" /> 
            {user ? `${user.displayName}'s Profile` : 'Profile & Login'}
          </CardTitle>
          <CardDescription>
            Manage your account details and preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-4">
              {user.photoURL && (
                <div className="flex justify-center">
                  <Image 
                    src={user.photoURL} 
                    alt={user.displayName || 'User Avatar'} 
                    width={80} 
                    height={80} 
                    className="rounded-full"
                    data-ai-hint="user avatar" 
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{user.displayName || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email || 'N/A'}</span>
              </div>
               <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gepto Coins:</span>
                <span className="flex items-center">{geptoCoins} <Coins className="h-4 w-4 inline text-yellow-500 ml-1" /></span>
              </div>
              <Button onClick={signOut} className="w-full mt-6" variant="destructive">
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-6">
                Login to manage your profile, view orders, and use Gepto Coins.
              </p>
              <Button onClick={signInWithGoogle} className="w-full">
                <LogIn className="mr-2 h-4 w-4" /> Login with Google
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
