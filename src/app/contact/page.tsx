
'use client'; // Add this directive

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import React from 'react'; // Import React

export default function ContactPage() {
  // Placeholder for form submission logic
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Add form submission logic here (e.g., send data to an API)
    alert('Thank you for your message! We will get back to you soon.');
    // Optionally reset the form
    (event.target as HTMLFormElement).reset();
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Contact Us</CardTitle>
          <CardDescription>
            Have questions or need assistance? Fill out the form below or reach out via our contact details. We serve the Cooch Behar area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">Contact Information</h3>
              <p className="text-muted-foreground mb-1"><strong>Owner:</strong> Aman Sah</p>
              <p className="text-muted-foreground mb-1"><strong>Email:</strong> Amanrck69@gmail.com</p>
              <p className="text-muted-foreground mb-1"><strong>Phone:</strong> +91 9547526440 / +91 8250522929</p>
              <p className="text-muted-foreground">
                <strong>Address:</strong> S.N. Road, Near BSF Camp, P.O: Cooch Behar, District: Koch Bihar, West Bengal, 736101, India
              </p>
              <p className="text-muted-foreground mt-2"><strong>Hours:</strong> Mon-Sun, 7:00 AM - 10:00 PM</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Send us a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" type="text" placeholder="Your Name" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Your Email Address" required />
                </div>
                 <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input id="phone" type="tel" placeholder="Your Phone Number" />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" placeholder="Your message..." required rows={4} />
                </div>
                <Button type="submit" className="w-full">Send Message</Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

