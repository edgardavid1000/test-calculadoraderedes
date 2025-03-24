document.addEventListener('DOMContentLoaded', function() {
    const ipForm = document.getElementById('ipForm');
    const ipInput = document.getElementById('ipInput');
    const resultsDiv = document.getElementById('results');
    const visualizationDiv = document.getElementById('visualization');
    const networkDiagram = document.getElementById('network-diagram');
    
    // Elementos de resultados
    const networkSpan = document.getElementById('network');
    const firstUsableSpan = document.getElementById('firstUsable');
    const ipSpan = document.getElementById('ip');
    const lastUsableSpan = document.getElementById('lastUsable');
    const broadcastSpan = document.getElementById('broadcast');
    const maskSpan = document.getElementById('mask');

    // Escuchar envío del formulario
    ipForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = ipInput.value.trim();
        
        if (!input) {
            alert('Por favor ingrese una dirección IP o máscara de red');
            return;
        }
        
        // Procesar la entrada y calcular los resultados
        const results = calculateNetwork(input);
        
        // Mostrar los resultados
        displayResults(results);
        
        // Generar visualización
        generateVisualization(results);
    });

    // Función principal para calcular la información de la red
    function calculateNetwork(input) {
        // Inicializar objeto de resultados
        const results = {
            network: '',
            firstUsable: '',
            ip: '',
            lastUsable: '',
            broadcast: '',
            mask: ''
        };
        
        try {
            // Caso 1: Solo CIDR (/24)
            if (input.startsWith('/')) {
                const cidr = parseInt(input.substring(1));
                results.mask = cidrToMask(cidr);
                
                return results;
            }
            
            // Caso 2: Solo máscara (255.255.255.0)
            if (isValidMask(input)) {
                results.mask = '/' + maskToCidr(input);
                
                return results;
            }
            
            // Determinar formato de entrada
            // Caso 3: IP/CIDR (192.168.1.0/24)
            if (input.includes('/')) {
                const parts = input.split('/');
                const ip = parts[0];
                const cidr = parseInt(parts[1]);
                
                if (!isValidIp(ip) || cidr < 0 || cidr > 32) {
                    throw new Error('Formato IP/CIDR inválido');
                }
                
                const mask = cidrToMask(cidr);
                
                calculateIpInfo(results, ip, mask, cidr);
            } 
            // Caso 4: IP Máscara (192.168.1.0 255.255.255.0)
            else if (input.includes(' ')) {
                const parts = input.split(' ');
                const ip = parts[0];
                const mask = parts[1];
                
                if (!isValidIp(ip) || !isValidMask(mask)) {
                    throw new Error('Formato IP Máscara inválido');
                }
                
                const cidr = maskToCidr(mask);
                
                calculateIpInfo(results, ip, mask, cidr);
            } else {
                throw new Error('Formato de entrada inválido');
            }
            
            return results;
            
        } catch (error) {
            alert('Error en el cálculo: ' + error.message);
            console.error(error);
            return results;
        }
    }
    
    // Calcular información de red a partir de IP y máscara
    function calculateIpInfo(results, ip, mask, cidr) {
        // Convertir IP a formato numérico (32 bits)
        const ipInt = ipToInt(ip);
        
        // Convertir máscara a formato numérico
        const maskInt = ipToInt(mask);
        
        // Calcular dirección de red (IP & Máscara)
        const networkInt = ipInt & maskInt;
        
        // Calcular broadcast (IP | ~Máscara)
        const broadcastInt = ipInt | (~maskInt >>> 0);
        
        // Convertir resultados a formato IP
        results.ip = ip;
        results.mask = (cidr !== undefined) ? '/' + cidr : mask;
        
        // Casos especiales para /31 y /32
        if (cidr === 32) {
            // /32 - host único
            results.network = 'No aplica';
            results.firstUsable = ip;
            results.lastUsable = ip;
            results.broadcast = 'No aplica';
        } else if (cidr === 31) {
            // /31 (RFC 3021) - dos direcciones, no hay red ni broadcast tradicionales
            results.network = intToIp(networkInt);
            results.firstUsable = 'No aplica';
            results.lastUsable = 'No aplica';
            results.broadcast = intToIp(broadcastInt);
        } else {
            // Caso general
            results.network = intToIp(networkInt);
            results.firstUsable = intToIp(networkInt + 1);
            results.lastUsable = intToIp(broadcastInt - 1);
            results.broadcast = intToIp(broadcastInt);
        }
    }
    
    // Convertir CIDR a máscara de subred
    function cidrToMask(cidr) {
        // Validar CIDR
        if (cidr < 0 || cidr > 32) {
            throw new Error('CIDR inválido');
        }
        
        // Crear máscara a partir del CIDR
        const mask = (0xFFFFFFFF << (32 - cidr)) >>> 0;
        
        // Convertir a formato de IP
        return intToIp(mask);
    }
    
    // Convertir máscara a CIDR
    function maskToCidr(mask) {
        // Validar máscara
        if (!isValidMask(mask)) {
            throw new Error('Máscara inválida');
        }
        
        // Convertir máscara a número
        const maskInt = ipToInt(mask);
        
        // Contar bits en 1
        let count = 0;
        let tempMask = maskInt;
        
        while (tempMask) {
            count += (tempMask & 1);
            tempMask >>>= 1;
        }
        
        return count;
    }
    
    // Convertir IP a entero de 32 bits
    function ipToInt(ip) {
        const octets = ip.split('.');
        
        if (octets.length !== 4) {
            throw new Error('Formato de IP inválido');
        }
        
        return ((parseInt(octets[0]) << 24) >>> 0) + 
               ((parseInt(octets[1]) << 16) >>> 0) + 
               ((parseInt(octets[2]) << 8) >>> 0) + 
               parseInt(octets[3]);
    }
    
    // Convertir entero a formato IP
    function intToIp(int) {
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }
    
    // Validar formato de IP
    function isValidIp(ip) {
        const octets = ip.split('.');
        
        if (octets.length !== 4) {
            return false;
        }
        
        for (let i = 0; i < 4; i++) {
            const octet = parseInt(octets[i]);
            
            if (isNaN(octet) || octet < 0 || octet > 255) {
                return false;
            }
        }
        
        return true;
    }
    
    // Validar formato de máscara
    function isValidMask(mask) {
        if (!isValidIp(mask)) {
            return false;
        }
        
        // Convertir a entero
        const maskInt = ipToInt(mask);
        
        // Verificar que sea una máscara válida (bits contiguos de 1 seguidos de bits contiguos de 0)
        const inverted = (~maskInt) >>> 0;
        
        // Verificar que inverted + 1 sea potencia de 2 o 0
        return (inverted + 1) & inverted === 0;
    }
    
    // Mostrar resultados en la interfaz
    function displayResults(results) {
        // Rellenar elementos con los resultados
        networkSpan.textContent = results.network;
        firstUsableSpan.textContent = results.firstUsable;
        ipSpan.textContent = results.ip;
        lastUsableSpan.textContent = results.lastUsable;
        broadcastSpan.textContent = results.broadcast;
        maskSpan.textContent = results.mask;
        
        // Mostrar sección de resultados
        resultsDiv.classList.remove('hidden');
        visualizationDiv.classList.remove('hidden');
    }
    
    // Generar visualización de la red
    function generateVisualization(results) {
        // Crear una representación visual simple de la red
        let html = '';
        
        if (results.network !== 'No aplica' && results.firstUsable !== 'No aplica') {
            // Obtener el tamaño de la red
            const maskParts = results.mask.toString().split('/');
            const cidr = maskParts.length > 1 ? parseInt(maskParts[1]) : maskToCidr(results.mask);
            
            // Definir SVG para la visualización
            html = `
                <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                    <!-- Rectángulo de red -->
                    <rect x="50" y="20" width="500" height="110" fill="#e6f2ff" stroke="#3b82f6" stroke-width="2"/>
                    
                    <!-- Dirección de red -->
                    <rect x="60" y="30" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                    <text x="110" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Red</text>
                    <text x="110" y="70" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.network}</text>
                    
                    <!-- Primera IP útil -->
                    <rect x="170" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                    <text x="220" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Primera IP</text>
                    <text x="220" y="70" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.firstUsable}</text>
                    
                    <!-- IP indicada -->
                    <rect x="280" y="30" width="100" height="40" fill="#93c5fd" stroke="#2563eb" stroke-width="1"/>
                    <text x="330" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">IP</text>
                    <text x="330" y="70" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.ip || 'N/A'}</text>
                    
                    <!-- Última IP útil -->
                    <rect x="390" y="30" width="100" height="40" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
                    <text x="440" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Última IP</text>
                    <text x="440" y="70" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.lastUsable}</text>
                    
                    <!-- Broadcast -->
                    <rect x="280" y="80" width="100" height="40" fill="#3b82f6" stroke="#2563eb" stroke-width="1"/>
                    <text x="330" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Broadcast</text>
                    <text x="330" y="120" font-family="sans-serif" font-size="10" text-anchor="middle" fill="white">${results.broadcast}</text>
                    
                    <!-- Máscara de red -->
                    <text x="110" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask}</text>
                    
                    <!-- Número de hosts -->
                    <text x="440" y="105" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">
                        Hosts: ${cidr < 31 ? Math.pow(2, 32 - cidr) - 2 : (cidr === 31 ? 2 : 1)}
                    </text>
                </svg>
            `;
        } else if (results.network === 'No aplica' && results.broadcast === 'No aplica') {
            // Caso /32 - host único
            html = `
                <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                    <!-- Rectángulo de host único -->
                    <rect x="200" y="50" width="200" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                    <text x="300" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Host Único</text>
                    <text x="300" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.ip}</text>
                    
                    <!-- Máscara de red -->
                    <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask}</text>
                </svg>
            `;
        } else if (results.firstUsable === 'No aplica') {
            // Caso /31 - red punto a punto
            html = `
                <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                    <!-- Visualización de red punto a punto -->
                    <rect x="150" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                    <text x="210" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Red</text>
                    <text x="210" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.network}</text>
                    
                    <line x1="270" y1="75" x2="330" y2="75" stroke="#0f172a" stroke-width="2" stroke-dasharray="5,5"/>
                    
                    <rect x="330" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2"/>
                    <text x="390" y="75" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Broadcast</text>
                    <text x="390" y="95" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">${results.broadcast}</text>
                    
                    <!-- Máscara de red -->
                    <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${results.mask} (Punto a Punto)</text>
                </svg>
            `;
        }
        
        // Insertar en el div de visualización
        networkDiagram.innerHTML = html;
    }
});
