export type Brand<K, T> = K & { readonly __brand: T };
export type Flavour<K, T> = K & { readonly __brand?: T };
