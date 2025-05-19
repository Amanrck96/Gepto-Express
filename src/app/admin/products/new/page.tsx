
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Basic product structure for the form state
interface NewProductFormState {
  name: string;
  description: string;
  price: string; // Keep as string for input, convert on submit
  category: string;
  imageUrl: string;
  inStock: boolean;
}

export default function AddNewProductPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<NewProductFormState>({
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    inStock: true, // Default to in stock
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox' && e.target instanceof HTMLInputElement) {
      setFormData(prev => ({ ...prev, [name]: e.target.checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.price || !formData.category) {
      toast({
        title: "Missing Fields",
        description: "Please fill in at least Name, Price, and Category.",
        variant: "destructive",
      });
      return;
    }

    const priceAsNumber = parseFloat(formData.price);
    if (isNaN(priceAsNumber) || priceAsNumber < 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid positive number for the price.",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      ...formData,
      price: priceAsNumber,
    };

    console.log("Submitting new product:", productData);
    // TODO: Implement API call to save the product to Firestore
    // For now, we'll just show a success toast and reset the form
    
    toast({
      title: "Product Submitted (Mock)",
      description: `${formData.name} would be added to the catalog. Backend integration needed.`,
    });
    
    // Reset form (optional)
    // setFormData({
    //   name: '',
    //   description: '',
    //   price: '',
    //   category: '',
    //   imageUrl: '',
    //   inStock: true,
    // });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/admin/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Product List
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Add New Product</CardTitle>
          <CardDescription>Fill in the details for the new product.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input 
                id="name" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Fresh Apples" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g., Juicy and crisp Shimla apples, 1kg pack"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g., 120.50"
                  required
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g., Fruits, Vegetables, Dairy"
                  required
                />
                {/* TODO: Convert to Select component once categories are managed */}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                type="url"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="e.g., https://placehold.co/300x300.png"
              />
              {formData.imageUrl && (
                <div className="mt-2">
                  <img 
                    src={formData.imageUrl || "https://placehold.co/100x100.png"} 
                    alt="Image Preview" 
                    className="h-24 w-24 object-cover rounded-md border"
                    data-ai-hint="product image"
                    onError={(e) => (e.currentTarget.src = "https://placehold.co/100x100.png")}
                   />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="inStock"
                name="inStock"
                checked={formData.inStock}
                onChange={handleChange}
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <Label htmlFor="inStock" className="text-sm font-medium">
                Product is in stock
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
                <Link href="/admin/products">Cancel</Link>
            </Button>
            <Button type="submit">Add Product</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
