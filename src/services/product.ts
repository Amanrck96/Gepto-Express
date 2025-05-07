
/**
 * Represents a product category.
 */
export interface Category {
  /**
   * The ID of the category.
   */
  id: string;
  /**
   * The name of the category.
   */
  name: string;
}

/**
 * Represents a product with its details.
 */
export interface Product {
  /**
   * The ID of the product.
   */
  id: string;
  /**
   * The name of the product.
   */
  name: string;
  /**
   * The description of the product.
   */
  description: string;
  /**
   * The price of the product.
   */
  price: number;
  /**
   * The URL of the product image.
   */
  imageUrl: string;
  /**
   * The category of the product.
   */
  category: Category;
}

/**
 * Asynchronously retrieves a list of products for a given store ID and category ID.
 *
 * @param storeId The ID of the store.
 * @param categoryId The ID of the category.
 * @returns A promise that resolves to an array of Product objects.
 */
export async function getProductsByStoreAndCategory(storeId: string, categoryId: string): Promise<Product[]> {
  // TODO: Implement this by calling an API.
  // Simulating different products based on category for better testing
  if (categoryId === 'fruit') {
    return [
      {
        id: 'product1',
        name: 'Apple',
        description: 'Fresh Shimla Apples, juicy and crisp.',
        price: 120.0, // Price per Kg
        imageUrl: 'https://picsum.photos/seed/apple/300/300',
        category: { id: 'fruit', name: 'Fruits' },
      },
      {
        id: 'product3',
        name: 'Banana',
        description: 'Ripe Nendran Bananas, pack of 6.',
        price: 60.0,
        imageUrl: 'https://picsum.photos/seed/banana/300/300',
        category: { id: 'fruit', name: 'Fruits' },
      },
      {
        id: 'product4',
        name: 'Orange',
        description: 'Sweet Nagpur Oranges, rich in Vitamin C.',
        price: 80.0, // Price per Kg
        imageUrl: 'https://picsum.photos/seed/orange/300/300',
        category: { id: 'fruit', name: 'Fruits' },
      },
    ];
  } else if (categoryId === 'dairy') {
    return [
      {
        id: 'product2',
        name: 'Milk',
        description: 'Fresh Full Cream Milk, 1 Litre pack.',
        price: 55.0,
        imageUrl: 'https://picsum.photos/seed/milk/300/300',
        category: { id: 'dairy', name: 'Dairy' },
      },
      {
        id: 'product5',
        name: 'Yogurt',
        description: 'Natural Plain Yogurt, 400g cup.',
        price: 45.0,
        imageUrl: 'https://picsum.photos/seed/yogurt/300/300',
        category: { id: 'dairy', name: 'Dairy' },
      },
      {
        id: 'product6',
        name: 'Butter',
        description: 'Salted Butter, 100g pack.',
        price: 50.0,
        imageUrl: 'https://picsum.photos/seed/butter/300/300',
        category: { id: 'dairy', name: 'Dairy' },
      },
    ];
  } else if (categoryId === 'vegetables') {
     return [
      {
        id: 'product7',
        name: 'Tomato',
        description: 'Fresh ripe tomatoes, 1kg.',
        price: 40.0,
        imageUrl: 'https://picsum.photos/seed/tomato/300/300',
        category: { id: 'vegetables', name: 'Vegetables'},
      },
      {
        id: 'product8',
        name: 'Potato',
        description: 'Fresh farm potatoes, 1kg.',
        price: 30.0,
        imageUrl: 'https://picsum.photos/seed/potato/300/300',
        category: { id: 'vegetables', name: 'Vegetables'},
      },
     ];
  }
  return []; // Default empty for other categories
}

/**
 * Asynchronously retrieves a list of product categories.
 *
 * @returns A promise that resolves to an array of Category objects.
 */
export async function getProductCategories(): Promise<Category[]> {
  // TODO: Implement this by calling an API.
  return [
    {
      id: 'fruit',
      name: 'Fruits',
    },
    {
      id: 'dairy',
      name: 'Dairy',
    },
    {
      id: 'vegetables',
      name: 'Vegetables',
    },
     {
      id: 'beverages',
      name: 'Beverages',
    },
    {
      id: 'snacks',
      name: 'Snacks',
    }
  ];
}
