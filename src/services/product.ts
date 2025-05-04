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
  return [
    {
      id: 'product1',
      name: 'Apple',
      description: 'Fresh Apple',
      price: 1.0,
      imageUrl: 'https://example.com/apple.jpg',
      category: {
        id: 'fruit',
        name: 'Fruits',
      },
    },
    {
      id: 'product2',
      name: 'Milk',
      description: 'Fresh Milk',
      price: 2.0,
      imageUrl: 'https://example.com/milk.jpg',
      category: {
        id: 'dairy',
        name: 'Dairy',
      },
    },
  ];
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
  ];
}
