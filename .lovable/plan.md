
# Plano: Mapa Completo de Adjacência de Bairros

## Levantamento dos Bairros nos Pedidos

Estes são TODOS os bairros que aparecem nos pedidos reais, organizados por cidade e posição geográfica:

### Osasco (12 pedidos) — Norte→Sul/Leste→Oeste
```text
ENTRADA (Leste, divisa SP):
  KM 18 → Quitaúna → Rochdale → Bonfim → I.A.P.I.

CENTRO:
  Umuarama → Centro → Bussocaba → Presidente Altino

SUL (divisa Carapicuíba):
  Veloso → Santa Maria → Aliança → Baronesa

SAÍDA (divisa SP/Barueri):
  Vila Yara → Jaguaré (SP) → Rio Pequeno (SP)
```

**Fluxo lógico de entrega Osasco:**
KM 18 → Quitaúna → Bonfim → I.A.P.I. → Umuarama → Veloso → Santa Maria → Aliança → Baronesa → Centro → Bussocaba → Presidente Altino → Vila Yara

### Carapicuíba (15 pedidos) — Norte→Sul
```text
NORTE (divisa Barueri/Osasco):
  Centro → Vila Maria Helena → Jardim Santa Brígida

CENTRO-NORTE:
  Jardim Novo Horizonte → Jardim Helena → Jardim Marilu

CENTRO-SUL:
  Pousada dos Bandeirantes → Parque Sampaio Viana

SUL (divisa Cotia/Jandira):
  Vila Silviania → Vila Capriotti → Recanto Campy → Parque Roseira → Cidade Ariston
```

### Barueri (4 pedidos)
```text
Vila Universal (norte) → Vila Engenho Novo (centro) → Parque Viana (sul, divisa Jandira)
```

### Jandira (3 pedidos)
```text
Jardim Novo Horizonte → Jardim Nossa Senhora de Fátima
```

### Itapevi (3 pedidos)
```text
Jardim Bela Vista → Vila Santa Flora → Jardim Gioia
```

### Embu (3 pedidos)
```text
Jardim Castilho → Jardim da Luz → Jardim Santo Antônio
```

### São Paulo (4 pedidos) — bairros zona oeste
```text
Jardim Adelfiore → Jardim D'Abril → Conj. Promorar Raposo Tavares
(todos na região de Raposo Tavares, perto de Osasco/Cotia)
```

### Santana de Parnaíba (1), Caieiras (1), Cajamar (1)
Poucos pedidos, adjacência mínima.

## Correções no Mapa de Adjacência

### Bairros de Osasco FALTANTES (6 bairros novos):
- **Umuarama**: vizinho de KM 18, Quitaúna, Centro
- **Veloso**: vizinho de Santa Maria, Conceição, Baronesa
- **Bonfim**: vizinho de I.A.P.I., Rochdale, KM 18
- **I.A.P.I.**: vizinho de Bonfim, Rochdale, Umuarama
- **Aliança**: vizinho de Baronesa, Santa Maria, Conceição
- **Baronesa**: vizinho de Aliança, Veloso, Santa Maria

### Bairros de Carapicuíba FALTANTES (11 bairros novos):
- **Centro (Carapicuíba)**: vizinho de Vila Maria Helena, Jardim Santa Brígida
- **Vila Maria Helena**: vizinho de Centro, Jardim Santa Brígida
- **Jardim Santa Brígida**: vizinho de Vila Maria Helena, Centro, Jardim Novo Horizonte
- **Jardim Novo Horizonte**: vizinho de Jardim Santa Brígida, Jardim Helena
- **Jardim Helena**: vizinho de Jardim Novo Horizonte, Jardim Marilu
- **Jardim Marilu**: vizinho de Jardim Helena, Pousada dos Bandeirantes
- **Parque Sampaio Viana**: vizinho de Pousada dos Bandeirantes, Vila Silviania
- **Vila Silviania**: vizinho de Parque Sampaio Viana, Vila Capriotti
- **Vila Capriotti**: vizinho de Vila Silviania, Recanto Campy
- **Recanto Campy**: vizinho de Vila Capriotti, Parque Roseira
- **Parque Roseira**: vizinho de Recanto Campy, Cidade Ariston
- **Cidade Ariston**: vizinho de Parque Roseira

### Bairros de Barueri FALTANTES:
- **Vila Universal**: vizinho de Vila Engenho Novo, Parque Viana
- **Vila Engenho Novo**: vizinho de Vila Universal, Parque Viana, Jardim Mutinga

### Bairros de SP FALTANTES:
- **Jardim Adelfiore**: vizinho de Jardim D'Abril, Parque Imperial
- **Jardim D'Abril**: vizinho de Jardim Adelfiore, Conjunto Promorar Raposo Tavares
- **Conjunto Promorar Raposo Tavares**: vizinho de Jardim D'Abril, Rio Pequeno

### Transições inter-cidades importantes:
- **Carapicuíba Centro** ↔ **Osasco (Veloso/Aliança)**: cidades vizinhas no limite sul
- **Parque Roseira/Cidade Ariston (Carapicuíba)** ↔ **Jandira**: divisa sul de Carapicuíba
- **Parque Viana (Barueri)** ↔ **Jardim Novo Horizonte (Jandira)**: divisa

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/anchorRules.ts` | Adicionar ~20 bairros ao `NEIGHBORHOOD_NEIGHBORS` com adjacências corretas baseadas em posição geográfica real |
