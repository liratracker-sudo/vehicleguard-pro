import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Converte data do formato BR (DD/MM/YYYY) para ISO (YYYY-MM-DD)
function convertBrazilDateToISO(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Se já está no formato ISO, retorna como está
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Formato esperado: DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const [day, month, year] = parts;
  
  // Validar se são números válidos
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) return null;
  
  // Retornar formato ISO: YYYY-MM-DD
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

interface VehicleData {
  id: string
  plate: string
  brand: string
  model: string
  year: string
  color: string
  has_gnv: boolean
  is_armored: boolean
}

// Determina a fonte de origem baseado nos dados recebidos
function determineReferralSource(data: {
  seller_id?: string
  referral_code?: string
  how_did_you_hear?: string
  utm_source?: string
}): string {
  if (data.seller_id) return 'seller'
  if (data.how_did_you_hear === 'indicacao_cliente') return 'client'
  if (data.how_did_you_hear === 'vendedor') return 'seller'
  if (data.utm_source) return 'campaign'
  if (data.how_did_you_hear) return 'organic'
  return 'direct'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const formData = await req.formData()
    
    // Extrair veículos do JSON
    const vehiclesJson = formData.get('vehicles') as string
    let vehicles: VehicleData[] = []
    
    try {
      vehicles = JSON.parse(vehiclesJson || '[]')
    } catch (e) {
      console.error('Error parsing vehicles JSON:', e)
      // Fallback para formato antigo (veículo único)
      const singleVehicle = {
        id: crypto.randomUUID(),
        plate: formData.get('vehicle_plate') as string || '',
        brand: formData.get('vehicle_brand') as string || '',
        model: formData.get('vehicle_model') as string || '',
        year: formData.get('vehicle_year') as string || '',
        color: formData.get('vehicle_color') as string || '',
        has_gnv: formData.get('has_gnv') === 'true',
        is_armored: formData.get('is_armored') === 'true'
      }
      if (singleVehicle.plate) {
        vehicles = [singleVehicle]
      }
    }

    console.log(`Processing registration with ${vehicles.length} vehicles`)

    // Extrair dados de rastreamento
    const companyId = formData.get('company_id') as string
    const sellerId = formData.get('seller_id') as string || null
    const referralCode = formData.get('referral_code') as string || null
    const referralInput = formData.get('referral_input') as string || null
    const utmSource = formData.get('utm_source') as string || null
    const utmMedium = formData.get('utm_medium') as string || null
    const utmCampaign = formData.get('utm_campaign') as string || null
    const howDidYouHear = formData.get('how_did_you_hear') as string || null

    // Determinar fonte de origem
    const referralSource = determineReferralSource({
      seller_id: sellerId || undefined,
      referral_code: referralCode || undefined,
      how_did_you_hear: howDidYouHear || undefined,
      utm_source: utmSource || undefined,
    })

    // Buscar nome do vendedor se fornecido
    let referralName: string | null = null
    let validatedSellerId: string | null = sellerId

    if (referralCode && !sellerId) {
      // Tentar encontrar vendedor pelo código
      const { data: seller } = await supabase
        .from('sellers')
        .select('id, name')
        .eq('company_id', companyId)
        .eq('code', referralCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle()

      if (seller) {
        validatedSellerId = seller.id
        referralName = seller.name
        console.log(`Found seller by code: ${seller.name}`)
      }
    } else if (sellerId) {
      // Buscar nome do vendedor pelo ID
      const { data: seller } = await supabase
        .from('sellers')
        .select('name')
        .eq('id', sellerId)
        .single()

      if (seller) {
        referralName = seller.name
      }
    }

    // Se não achou vendedor mas tem input de referência, usar como nome
    if (!referralName && referralInput) {
      referralName = referralInput.toUpperCase()
    }

    // Extrair dados do formulário
    const registrationData = {
      company_id: companyId,
      name: formData.get('name') as string,
      birth_date: convertBrazilDateToISO(formData.get('birth_date') as string),
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      document: formData.get('document') as string,
      cep: formData.get('cep') as string,
      street: formData.get('street') as string,
      number: formData.get('number') as string,
      complement: formData.get('complement') as string,
      neighborhood: formData.get('neighborhood') as string,
      city: formData.get('city') as string,
      state: formData.get('state') as string,
      emergency_contact_name: formData.get('emergency_contact_name') as string,
      emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
      emergency_contact_phone: formData.get('emergency_contact_phone') as string,
      // Dados do primeiro veículo para retrocompatibilidade
      vehicle_plate: vehicles[0]?.plate || '',
      vehicle_brand: vehicles[0]?.brand || '',
      vehicle_model: vehicles[0]?.model || '',
      vehicle_year: parseInt(vehicles[0]?.year) || new Date().getFullYear(),
      vehicle_color: vehicles[0]?.color || '',
      has_gnv: vehicles[0]?.has_gnv || false,
      is_armored: vehicles[0]?.is_armored || false,
      // Campos de rastreamento
      referral_source: referralSource,
      referral_code: referralCode || referralInput || null,
      referral_name: referralName,
      seller_id: validatedSellerId,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      how_did_you_hear: howDidYouHear,
    }

    console.log('Processing registration for:', registrationData.name)
    console.log('Referral source:', referralSource, 'Seller ID:', validatedSellerId)

    // Upload dos documentos
    let documentFrontUrl = null
    let documentBackUrl = null

    const documentFront = formData.get('document_front') as File
    const documentBack = formData.get('document_back') as File

    if (documentFront) {
      const frontFileName = `${registrationData.company_id}/${Date.now()}_front_${documentFront.name}`
      const { data: frontData, error: frontError } = await supabase.storage
        .from('client-documents')
        .upload(frontFileName, documentFront, {
          contentType: documentFront.type,
          upsert: false
        })

      if (frontError) {
        console.error('Error uploading front document:', frontError)
        throw new Error('Erro ao fazer upload do documento (frente)')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(frontFileName)
      
      documentFrontUrl = publicUrl
    }

    if (documentBack) {
      const backFileName = `${registrationData.company_id}/${Date.now()}_back_${documentBack.name}`
      const { data: backData, error: backError } = await supabase.storage
        .from('client-documents')
        .upload(backFileName, documentBack, {
          contentType: documentBack.type,
          upsert: false
        })

      if (backError) {
        console.error('Error uploading back document:', backError)
        throw new Error('Erro ao fazer upload do documento (verso)')
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-documents')
        .getPublicUrl(backFileName)
      
      documentBackUrl = publicUrl
    }

    // Inserir registro principal
    const { data: registration, error: insertError } = await supabase
      .from('client_registrations')
      .insert({
        ...registrationData,
        document_front_url: documentFrontUrl,
        document_back_url: documentBackUrl,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting registration:', insertError)
      throw new Error('Erro ao salvar cadastro')
    }

    console.log('Registration created successfully:', registration.id)

    // Inserir veículos na tabela separada
    if (vehicles.length > 0) {
      const vehicleRecords = vehicles.map(v => ({
        registration_id: registration.id,
        vehicle_plate: v.plate,
        vehicle_brand: v.brand,
        vehicle_model: v.model,
        vehicle_year: parseInt(v.year) || new Date().getFullYear(),
        vehicle_color: v.color,
        has_gnv: v.has_gnv || false,
        is_armored: v.is_armored || false
      }))

      const { error: vehiclesError } = await supabase
        .from('client_registration_vehicles')
        .insert(vehicleRecords)

      if (vehiclesError) {
        console.error('Error inserting vehicles:', vehiclesError)
        // Não falhar o cadastro por causa dos veículos na tabela separada
        // já que mantemos retrocompatibilidade com os campos na tabela principal
      } else {
        console.log(`${vehicles.length} vehicles inserted successfully`)
      }
    }

    // Notificar admins sobre novo cadastro (não aguardar resposta)
    supabase.functions.invoke('notify-registration-admin', {
      body: {
        company_id: registrationData.company_id,
        registration_id: registration.id,
        registration_name: registrationData.name,
        vehicles_count: vehicles.length,
        referral_source: referralSource,
        referral_name: referralName,
      }
    }).catch(err => {
      console.error('Failed to notify admins:', err)
      // Não falhar o cadastro se a notificação falhar
    })

    return new Response(
      JSON.stringify({
        success: true,
        registration_id: registration.id,
        vehicles_count: vehicles.length,
        referral_source: referralSource,
        message: 'Cadastro enviado com sucesso!'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in process-client-registration:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar cadastro'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
