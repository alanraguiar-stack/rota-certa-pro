const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Job {
  id: string;
  lat: number;
  lng: number;
}

interface OptimizeRequest {
  jobs: Job[];
  cdLat: number;
  cdLng: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ORS_API_KEY = Deno.env.get('ORS_API_KEY');
    if (!ORS_API_KEY) {
      console.error('ORS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'ORS_API_KEY not configured', optimizedOrder: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: OptimizeRequest = await req.json();
    const { jobs, cdLat, cdLng } = body;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ optimizedOrder: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build ORS optimization payload
    const orsPayload = {
      jobs: jobs.map((j, i) => ({
        id: i,
        location: [j.lng, j.lat], // ORS uses [lng, lat]
        service: 300, // 5 min per stop
      })),
      vehicles: [{
        id: 0,
        profile: 'driving-car',
        start: [cdLng, cdLat],
        end: [cdLng, cdLat],
      }],
    };

    console.log(`[optimize-route] Sending ${jobs.length} jobs to ORS`);

    const orsResponse = await fetch('https://api.openrouteservice.org/optimization', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orsPayload),
    });

    if (!orsResponse.ok) {
      const errorText = await orsResponse.text();
      console.error(`[optimize-route] ORS error ${orsResponse.status}: ${errorText}`);
      return new Response(JSON.stringify({ optimizedOrder: null, error: `ORS ${orsResponse.status}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orsResult = await orsResponse.json();

    // Extract optimized sequence from steps
    const route = orsResult.routes?.[0];
    if (!route || !route.steps) {
      console.error('[optimize-route] No route in ORS response');
      return new Response(JSON.stringify({ optimizedOrder: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter only "job" steps (exclude start/end) and map back to original IDs
    const jobSteps = route.steps.filter((s: any) => s.type === 'job');
    const optimizedOrder: string[] = jobSteps.map((s: any) => jobs[s.job].id);

    console.log(`[optimize-route] ORS optimized ${optimizedOrder.length} deliveries, distance: ${route.distance}m, duration: ${route.duration}s`);

    return new Response(JSON.stringify({ 
      optimizedOrder,
      orsDistance: route.distance,
      orsDuration: route.duration,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[optimize-route] Error:', error);
    return new Response(JSON.stringify({ optimizedOrder: null, error: String(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
