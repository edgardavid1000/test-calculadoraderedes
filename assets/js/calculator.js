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
    const maskSpan = document.getElementById('mask'); // This is the element to display the mask

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

        // Mostrar los resultados si son válidos
        if (results) {
            displayResults(results);
            // Pass the full results object to the visualization function
            generateVisualization(results);
        } else {
            // Opcional: Limpiar resultados anteriores si hubo un error manejado
             resultsDiv.classList.add('hidden');
             visualizationDiv.classList.add('hidden');
        }
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
            mask: '', // Will store the full dotted-decimal mask internally
            cidr: null, // Will store the CIDR value internally
            maskToDisplay: '' // Will store the string to be displayed in the results table
        };

        try {
            // Caso 1: Solo CIDR (/24)
            if (input.startsWith('/') && !input.includes('.')) {
                const cidr = parseInt(input.substring(1));
                 if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Formato CIDR inválido');
                }
                results.mask = cidrToMask(cidr); // Store full mask internally
                results.cidr = cidr; // Store CIDR internally
                // Display format: /CIDR (Full Mask)
                results.maskToDisplay = `/${cidr} (${results.mask})`;
                results.network = 'N/A';
                results.firstUsable = 'N/A';
                results.ip = 'N/A';
                results.lastUsable = 'N/A';
                results.broadcast = 'N/A';
                return results;
            }

            // Caso 2: Solo máscara (255.255.255.0)
            if (!input.includes('/') && !input.includes(' ') && isValidIp(input) && isValidMask(input)) {
                 const cidr = maskToCidr(input);
                 results.mask = input; // Store full mask internally
                 results.cidr = cidr; // Store CIDR internally
                 // Display format: Full Mask (/CIDR)
                 results.maskToDisplay = `${results.mask} (/${cidr})`;
                 results.network = 'N/A';
                 results.firstUsable = 'N/A';
                 results.ip = 'N/A';
                 results.lastUsable = 'N/A';
                 results.broadcast = 'N/A';
                 return results;
            }

            // Determinar formato de entrada
            // Caso 3: IP/CIDR (192.168.1.0/24)
            if (input.includes('/')) {
                const parts = input.split('/');
                const ip = parts[0];
                const cidrStr = parts[1];

                if (parts.length !== 2 || !isValidIp(ip)) {
                     throw new Error('Formato IP/CIDR inválido');
                }
                const cidr = parseInt(cidrStr);
                if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                    throw new Error('Valor CIDR inválido');
                }

                const mask = cidrToMask(cidr);
                results.cidr = cidr; // Store CIDR internally
                results.mask = mask; // Store full mask internally
                calculateIpInfo(results, ip, mask, cidr); // Calculate network details
                // Display format: Full Mask (/CIDR)
                results.maskToDisplay = `${mask} (/${cidr})`;
            }
            // Caso 4: IP Máscara (192.168.1.0 255.255.255.0)
            else if (input.includes(' ')) {
                const parts = input.split(/\s+/).filter(part => part.length > 0);

                if (parts.length !== 2) {
                     throw new Error('Formato IP Máscara inválido - se esperaban dos partes separadas por espacio');
                }

                const ip = parts[0];
                const mask = parts[1];

                if (!isValidIp(ip) || !isValidMask(mask)) {
                    throw new Error('Formato IP o Máscara inválido');
                }

                const cidr = maskToCidr(mask);
                results.cidr = cidr; // Store CIDR internally
                results.mask = mask; // Store full mask internally
                calculateIpInfo(results, ip, mask, cidr); // Calculate network details
                // Display format: Full Mask (/CIDR)
                results.maskToDisplay = `${mask} (/${cidr})`;
            } else if (isValidIp(input)) {
                 // Caso 5: Solo IP
                 throw new Error('Formato de entrada inválido. Falta máscara o CIDR.');
            } else {
                throw new Error('Formato de entrada inválido');
            }

            return results;

        } catch (error) {
            alert('Error en el cálculo: ' + error.message);
            console.error(error);
            return null; // Devolver null para indicar error
        }
    }

    // Calcular información de red a partir de IP y máscara (no modifica maskToDisplay)
    function calculateIpInfo(results, ip, mask, cidr) {
        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        const broadcastInt = networkInt | (~maskInt >>> 0);

        // Store the full mask internally (already done in calculateNetwork, but good to be explicit)
        results.mask = mask;
        // Store the cidr internally (already done in calculateNetwork)
        results.cidr = cidr;

        if (cidr === 32) {
            results.network = 'No aplica';
            results.firstUsable = ip;
            results.ip = ip;
            results.lastUsable = ip;
            results.broadcast = 'No aplica';
        } else if (cidr === 31) {
            results.network = intToIp(networkInt);
            results.firstUsable = 'No aplica';
            results.ip = ip; // Show the specific IP provided by the user
            results.lastUsable = 'No aplica';
            results.broadcast = intToIp(broadcastInt);
        } else {
            // Caso general (CIDR 0 a 30)
            results.network = intToIp(networkInt);
            results.firstUsable = (networkInt + 1 < broadcastInt) ? intToIp(networkInt + 1) : 'N/A';
            results.ip = ip; // Display the specific IP provided by the user
            results.lastUsable = (broadcastInt - 1 > networkInt) ? intToIp(broadcastInt - 1) : 'N/A';
            results.broadcast = intToIp(broadcastInt);
        }
    }

    // Convertir CIDR a máscara de subred
    function cidrToMask(cidr) {
        if (cidr < 0 || cidr > 32) {
            throw new Error('CIDR inválido: ' + cidr);
        }
        const mask = (cidr === 0) ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
        return intToIp(mask);
    }

    // Convertir máscara a CIDR
    function maskToCidr(mask) {
        if (!isValidMask(mask)) {
            throw new Error('Máscara inválida al convertir a CIDR: ' + mask);
        }
        const maskInt = ipToInt(mask);
        const inverted = (~maskInt) >>> 0;

        if (inverted === 0) return 32; // 255.255.255.255
        if (inverted === 0xFFFFFFFF) return 0; // 0.0.0.0

        // Verificar que inverted + 1 sea potencia de 2
        if (((inverted + 1) & inverted) !== 0) {
             throw new Error("Máscara inválida (bits no contiguos) al convertir a CIDR: " + mask);
        }

        return 32 - Math.log2(inverted + 1);
    }

    // Convertir IP a entero de 32 bits
    function ipToInt(ip) {
        const octets = ip.split('.');
        if (octets.length !== 4) {
            // Allow throwing error here as it indicates invalid IP format during calculation
            throw new Error(`Formato IP inválido "${ip}"`);
        }
        return octets.reduce((res, octet) => {
             const val = parseInt(octet);
             if (isNaN(val) || val < 0 || val > 255) {
                 throw new Error(`Octeto inválido "${octet}" en la IP "${ip}"`);
             }
             // Disallow leading zeros unless the octet is just "0"
             if (octet.length > 1 && octet.startsWith('0')) {
                 throw new Error(`Octeto inválido con cero inicial "${octet}" en la IP "${ip}"`);
             }
             return (res << 8) | val;
        }, 0) >>> 0;
    }


    // Convertir entero a formato IP
    function intToIp(int) {
        if (typeof int !== 'number' || isNaN(int)) {
            console.error("intToIp recibió un valor no numérico:", int);
            return "Error";
        }
        return [
            (int >>> 24) & 255,
            (int >>> 16) & 255,
            (int >>> 8) & 255,
            int & 255
        ].join('.');
    }

    // Validar formato de IP (stricter about leading zeros)
    function isValidIp(ip) {
        if (typeof ip !== 'string') return false;
        const octets = ip.split('.');
        if (octets.length !== 4) {
            return false;
        }
        return octets.every(octet => {
            // Allow "0" but not "01", "00", etc.
            if (octet.length > 1 && octet.startsWith('0')) {
                 return false;
            }
            const num = parseInt(octet);
            // Ensure conversion back to string matches original (handles non-integer strings)
            return !isNaN(num) && num >= 0 && num <= 255 && String(num) === octet;
        });
    }

    // Validar formato de máscara
    function isValidMask(mask) {
        if (!isValidIp(mask)) { // Use the stricter isValidIp
            return false;
        }
        try {
            // Convert to int using the potentially throwing ipToInt
            const maskInt = ipToInt(mask);
            const inverted = (~maskInt) >>> 0;
            const plusOne = (inverted + 1) >>> 0;

            // 0.0.0.0 and 255.255.255.255 are valid masks
            if (maskInt === 0 || maskInt === 0xFFFFFFFF) return true;

            // Check if (inverted + 1) is a power of 2 (meaning inverted is all 1s at the end)
            // This ensures the mask bits are contiguous 1s followed by contiguous 0s
            return (plusOne & inverted) === 0;

        } catch (e) {
             // If ipToInt threw an error (e.g., invalid octet), it's not a valid mask format
             return false;
        }
    }

    // Mostrar resultados en la interfaz
    function displayResults(results) {
        networkSpan.textContent = results.network;
        firstUsableSpan.textContent = results.firstUsable;
        ipSpan.textContent = results.ip; // Show the IP entered by the user
        lastUsableSpan.textContent = results.lastUsable;
        broadcastSpan.textContent = results.broadcast;
        // Use the consistently formatted mask string for display
        maskSpan.textContent = results.maskToDisplay;

        resultsDiv.classList.remove('hidden');
        visualizationDiv.classList.remove('hidden');
    }

    // Generar visualización de la red (MODIFIED to accept full results object)
    function generateVisualization(results) {
        let html = '';
        const { mask, cidr, network, firstUsable, ip, lastUsable, broadcast, maskToDisplay } = results;

        // Check if we have valid data for visualization (at least a valid CIDR)
        if (cidr !== null && cidr >= 0 && cidr <= 32 && mask && mask !== 'N/A') {

            // Calculate number of hosts (usable IPs)
            let numHosts = 0;
            if (cidr >= 0 && cidr <= 30) {
                numHosts = Math.pow(2, 32 - cidr) - 2;
            } else if (cidr === 31) {
                numHosts = 0; // Technically 2 IPs, but 0 usable hosts in the traditional sense
            } else if (cidr === 32) {
                numHosts = 0; // 1 IP, 0 usable hosts
            }
            const hostText = numHosts >= 0 ? numHosts : 'N/A';

            // Text to show for the mask in the visualization (use the same as results table)
            const maskDisplayText = maskToDisplay;
            const ipTextLength = "85"; // Adjusted text length for IPs
            const ipFontSize = "9"; // Adjusted font size for IPs

            // Case 1: Only Mask or CIDR was provided (network is 'N/A')
            if (network === 'N/A') {
                 html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="150" y="40" width="300" height="70" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="2" rx="5"/>
                        <text x="300" y="70" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#1e293b">Información de Máscara</text>
                        <text x="300" y="90" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#475569">Máscara: ${maskDisplayText}</text>
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Hosts Útiles: ${hostText}</text>
                        <text x="300" y="25" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#64748b">(No se proporcionó IP para detalles de red)</text>
                    </svg>
                 `;
            }
            // Case 2: /32 - host único
            else if (cidr === 32) {
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="200" y="50" width="200" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2" rx="4"/>
                        <text x="300" y="70" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">Host Único</text>
                        <text x="300" y="90" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="180" lengthAdjust="spacingAndGlyphs">${firstUsable}</text> {/* Use firstUsable which is the IP itself */}
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${maskDisplayText}</text>
                    </svg>
                `;
            }
            // Case 3: /31 - red punto a punto
            else if (cidr === 31) {
                 const ip1 = network; // First IP in /31 is the network address
                 const ip2 = broadcast; // Second IP in /31 is the broadcast address
                html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        <rect x="150" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2" rx="4"/>
                        <text x="210" y="70" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 1</text>
                        <text x="210" y="90" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="100" lengthAdjust="spacingAndGlyphs">${ip1}</text>
                        <line x1="270" y1="75" x2="330" y2="75" stroke="#0f172a" stroke-width="2" stroke-dasharray="5,5"/>
                        <rect x="330" y="50" width="120" height="50" fill="#3b82f6" stroke="#2563eb" stroke-width="2" rx="4"/>
                        <text x="390" y="70" font-family="sans-serif" font-size="14" text-anchor="middle" fill="white">IP 2</text>
                        <text x="390" y="90" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="100" lengthAdjust="spacingAndGlyphs">${ip2}</text>
                        <text x="300" y="130" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0f172a">Máscara: ${maskDisplayText} (Punto a Punto)</text>
                    </svg>
                `;
            }
            // Case 4: General case (CIDR 0 to 30)
            else {
                 html = `
                    <svg width="100%" height="100%" viewBox="0 0 600 150" xmlns="http://www.w3.org/2000/svg">
                        {/* Main Box */}
                        <rect x="50" y="20" width="500" height="110" fill="#e6f2ff" stroke="#3b82f6" stroke-width="1" rx="5"/>

                        {/* Network Address */}
                        <rect x="60" y="30" width="100" height="45" fill="#3b82f6" stroke="#2563eb" stroke-width="1" rx="3"/>
                        <text x="110" y="48" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Red</text>
                        <text x="110" y="65" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${network}</text>

                        {/* First Usable IP */}
                        <rect x="170" y="30" width="100" height="45" fill="#60a5fa" stroke="#2563eb" stroke-width="1" rx="3"/>
                        <text x="220" y="48" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Primera IP</text>
                        <text x="220" y="65" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${firstUsable}</text>

                        {/* Placeholder for IP Range - Centered */}
                        <text x="320" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">(Rango de Hosts)</text>

                        {/* Last Usable IP */}
                        <rect x="370" y="30" width="100" height="45" fill="#60a5fa" stroke="#2563eb" stroke-width="1" rx="3"/>
                        <text x="420" y="48" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Última IP</text>
                        <text x="420" y="65" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${lastUsable}</text>

                        {/* Broadcast Address - Centered below */}
                        <rect x="225" y="80" width="100" height="45" fill="#3b82f6" stroke="#2563eb" stroke-width="1" rx="3"/>
                        <text x="275" y="98" font-family="sans-serif" font-size="12" text-anchor="middle" fill="white">Broadcast</text>
                        <text x="275" y="115" font-family="sans-serif" font-size="${ipFontSize}" text-anchor="middle" fill="white" textLength="${ipTextLength}" lengthAdjust="spacingAndGlyphs">${broadcast}</text>

                        {/* Mask Info */}
                        <text x="110" y="105" font-family="sans-serif" font-size="11" text-anchor="start" fill="#0f172a">Máscara: ${maskDisplayText}</text>

                        {/* Host Count Info */}
                        <text x="490" y="105" font-family="sans-serif" font-size="11" text-anchor="end" fill="#0f172a">
                            Hosts: ${hostText}
                        </text>
                    </svg>
                `;
            }
        } else {
             // Fallback message if data is insufficient for any visualization
             html = `<p style="text-align: center; color: #6b7280;">No se puede generar la visualización con la entrada proporcionada.</p>`;
        }

        // Insertar en el div de visualización
        networkDiagram.innerHTML = html;
    }
});
