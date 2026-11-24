export type DemoProduct = { id: string; name: string; description: string };

export const demoProducts: readonly DemoProduct[] = [
  {
    id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b01',
    name: 'Trail running shoes',
    description: 'Light shoes with a grippy sole for wet trails.',
  },
  {
    id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b02',
    name: 'Merino T-shirt',
    description: 'Soft wool that stays fresh on long days.',
  },
  {
    id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b03',
    name: 'Rain jacket',
    description: 'Waterproof shell that packs into its own pocket.',
  },
  {
    id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b04',
    name: 'Hiking socks',
    description: 'Cushioned socks, two pairs.',
  },
  {
    id: '6f1d3a52-0c5e-4b8a-9d61-1f3c2a7e9b05',
    name: 'Limited edition trail shoes',
    description:
      'Sold out at the warehouse: buy them to see an order canceled for lack of stock.',
  },
];

export const soldOutDemoProduct = demoProducts[demoProducts.length - 1]!;

export const demoProductName = (productId: string): string =>
  demoProducts.find(({ id }) => id === productId)?.name ?? productId;
