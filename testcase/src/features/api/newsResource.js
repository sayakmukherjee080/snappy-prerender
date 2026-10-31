import { fetchNewsArticles } from '../../lib/newsApi.js';
import { createResource } from '../../lib/resource.js';

export const newsResource = createResource(fetchNewsArticles);

// Start the request when the API route chunk loads, before React renders the consumer.
newsResource.load();
