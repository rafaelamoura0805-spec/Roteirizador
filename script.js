// ============================================
// 🚚 ROTEIRIZADOR SALVADOR
// ============================================


// ============================================
// MAPA
// ============================================

const mapa = L.map("mapa").setView(
    [-12.9714, -38.5014],
    12
);


L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution:
            "&copy; OpenStreetMap contributors"
    }
).addTo(mapa);


// ============================================
// VARIÁVEIS
// ============================================

let numeroEntregas = 1;

let marcadores = [];

let linhaRota = null;


// ============================================
// CONFIGURAÇÃO
// ============================================

// Atrasos pequenos são permitidos.
// Quanto maior o atraso, pior fica a rota.

const toleranciaAtraso = 30;


// ============================================
// ATIVAR/DESATIVAR HORÁRIO
// ============================================

function configurarCheckbox(
    checkbox,
    horario
) {

    checkbox.addEventListener(
        "change",
        function () {

            horario.disabled =
                !checkbox.checked;


            const campo =
                horario.parentElement;


            if (
                checkbox.checked
            ) {

                campo.classList.remove(
                    "desativado"
                );

            } else {

                campo.classList.add(
                    "desativado"
                );

            }

        }
    );

}


// ============================================
// PRIMEIRO CHECKBOX
// ============================================

const primeiroCheckbox =
    document.querySelector(
        ".temHorario"
    );


const primeiroHorario =
    document.querySelector(
        ".horario"
    );


configurarCheckbox(
    primeiroCheckbox,
    primeiroHorario
);


primeiroHorario.parentElement
    .classList.add(
        "desativado"
    );


// ============================================
// ADICIONAR ENTREGA
// ============================================

document
    .getElementById("adicionar")
    .addEventListener(
        "click",
        function () {

            numeroEntregas++;


            const container =
                document.getElementById(
                    "entregas"
                );


            const novaEntrega =
                document.createElement(
                    "div"
                );


            novaEntrega.className =
                "entrega";


            novaEntrega.innerHTML = `

                <div class="numero">
                    ${numeroEntregas}
                </div>


                <div class="dados">


                    <label>
                        Endereço
                    </label>


                    <input
                        type="text"
                        class="endereco"
                        placeholder="Ex: Barra, Salvador"
                    >


                    <div class="checkbox-horario">

                        <input
                            type="checkbox"
                            class="temHorario"
                        >

                        <span>
                            Cliente tem horário marcado
                        </span>

                    </div>


                    <div class="campo-horario desativado">

                        <label>
                            Horário marcado
                        </label>

                        <input
                            type="time"
                            class="horario"
                            value="08:00"
                            disabled
                        >

                    </div>


                </div>

            `;


            container.appendChild(
                novaEntrega
            );


            const checkbox =
                novaEntrega.querySelector(
                    ".temHorario"
                );


            const horario =
                novaEntrega.querySelector(
                    ".horario"
                );


            configurarCheckbox(
                checkbox,
                horario
            );

        }
    );


// ============================================
// BUSCAR ENDEREÇO
// ============================================

async function buscarEndereco(
    endereco
) {

    const url =
        "https://nominatim.openstreetmap.org/search?" +
        "format=json" +
        "&limit=1" +
        "&countrycodes=br" +
        "&q=" +
        encodeURIComponent(
            endereco
        );


    const resposta =
        await fetch(url);


    if (!resposta.ok) {

        throw new Error(
            "Erro ao buscar endereço."
        );

    }


    const dados =
        await resposta.json();


    if (
        dados.length === 0
    ) {

        throw new Error(
            "Endereço não encontrado: " +
            endereco
        );

    }


    return {

        lat:
            parseFloat(
                dados[0].lat
            ),

        lon:
            parseFloat(
                dados[0].lon
            ),

        nome:
            dados[0].display_name

    };

}


// ============================================
// HORÁRIO → MINUTOS
// ============================================

function horarioParaMinutos(
    horario
) {

    const partes =
        horario.split(":");


    return (
        parseInt(
            partes[0]
        ) * 60
        +
        parseInt(
            partes[1]
        )
    );

}


// ============================================
// MINUTOS → HORÁRIO
// ============================================

function minutosParaHorario(
    minutos
) {

    const horas =
        Math.floor(
            minutos / 60
        );


    const mins =
        Math.round(
            minutos % 60
        );


    return (
        String(
            horas
        ).padStart(2, "0")
        +
        ":"
        +
        String(
            mins
        ).padStart(2, "0")
    );

}


// ============================================
// CALCULAR ROTA
// ============================================

async function calcularRota(
    pontos
) {

    const coordenadas =
        pontos
            .map(
                ponto =>
                    `${ponto.lon},${ponto.lat}`
            )
            .join(";");


    const url =
        `https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=false`;


    const resposta =
        await fetch(url);


    if (!resposta.ok) {

        throw new Error(
            "Erro no serviço de rotas."
        );

    }


    const dados =
        await resposta.json();


    if (
        dados.code !== "Ok"
    ) {

        throw new Error(
            "Não foi possível calcular a rota."
        );

    }


    return dados.routes[0];

}


// ============================================
// AVALIAR UMA SEQUÊNCIA
// ============================================

async function avaliarRota(
    origem,
    entregas,
    inicioJornada,
    fimJornada
) {


    const pontos = [

        origem,

        ...entregas

    ];


    const rota =
        await calcularRota(
            pontos
        );


    let horarioAtual =
        inicioJornada;


    let penalidade =
        0;


    const chegadas = [];


    const atrasos = [];


    const duracoes =
        rota.legs.map(
            leg =>
                leg.duration / 60
        );


    // ========================================
    // PERCORRER ENTREGAS
    // ========================================

    for (
        let i = 0;
        i < entregas.length;
        i++
    ) {


        // Tempo de deslocamento

        horarioAtual +=
            duracoes[i];


        const entrega =
            entregas[i];


        let atraso = 0;


        // ====================================
        // CLIENTE COM HORÁRIO
        // ====================================

        if (
            entrega.temHorario
        ) {


            const horarioDesejado =
                horarioParaMinutos(
                    entrega.horario
                );


            // Se chegou antes,
            // espera até o horário

            if (
                horarioAtual <
                horarioDesejado
            ) {

                horarioAtual =
                    horarioDesejado;

            }


            // Calcula atraso

            atraso =
                Math.max(
                    0,
                    horarioAtual -
                    horarioDesejado
                );


            // Pequeno atraso

            if (
                atraso <=
                toleranciaAtraso
            ) {

                penalidade +=
                    atraso * 100;


            } else {

                // Atraso grande

                penalidade +=
                    atraso * 100000;

            }

        }


        // ====================================
        // CLIENTE SEM HORÁRIO
        // ====================================

        else {

            /*
                Cliente sem horário NÃO gera
                penalidade.

                O sistema fica livre para
                encaixá-lo onde a rota
                ficar mais eficiente.
            */

        }


        chegadas.push(
            horarioAtual
        );


        atrasos.push(
            atraso
        );


        // ====================================
        // JORNADA
        // ====================================

        if (
            horarioAtual >
            fimJornada
        ) {

            const excesso =
                horarioAtual -
                fimJornada;


            penalidade +=
                excesso *
                100000;

        }

    }


    return {

        distancia:
            rota.distance,

        duracao:
            rota.duration,

        penalidade:
            penalidade,

        chegadas:
            chegadas,

        atrasos:
            atrasos,

        horarioFinal:
            horarioAtual

    };

}


// ============================================
// GERAR PERMUTAÇÕES
// ============================================

function gerarPermutacoes(
    lista
) {


    if (
        lista.length <= 1
    ) {

        return [lista];

    }


    const resultado = [];


    for (
        let i = 0;
        i < lista.length;
        i++
    ) {


        const atual =
            lista[i];


        const restante =
            lista
                .slice(0, i)
                .concat(
                    lista.slice(
                        i + 1
                    )
                );


        const possibilidades =
            gerarPermutacoes(
                restante
            );


        possibilidades.forEach(
            possibilidade => {

                resultado.push([

                    atual,

                    ...possibilidade

                ]);

            }
        );

    }


    return resultado;

}


// ============================================
// LIMPAR MAPA
// ============================================

function limparMapa() {


    marcadores.forEach(
        marcador => {

            mapa.removeLayer(
                marcador
            );

        }
    );


    marcadores = [];


    if (
        linhaRota
    ) {

        mapa.removeLayer(
            linhaRota
        );

        linhaRota = null;

    }

}


// ============================================
// DESENHAR ROTA
// ============================================

async function desenharRota(
    pontos
) {


    const coordenadas =
        pontos
            .map(
                ponto =>
                    `${ponto.lon},${ponto.lat}`
            )
            .join(";");


    const url =
        `https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson`;


    const resposta =
        await fetch(url);


    const dados =
        await resposta.json();


    if (
        dados.code !== "Ok"
    ) {

        throw new Error(
            "Erro ao desenhar a rota."
        );

    }


    linhaRota =
        L.geoJSON(
            dados.routes[0].geometry
        )
        .addTo(mapa);


    mapa.fitBounds(
        linhaRota.getBounds(),
        {
            padding: [
                30,
                30
            ]
        }
    );

}


// ============================================
// CALCULAR MELHOR ROTA
// ============================================

document
    .getElementById("calcular")
    .addEventListener(
        "click",
        async function () {


            const resultado =
                document.getElementById(
                    "resultado"
                );


            try {


                // =================================
                // JORNADA
                // =================================

                const inicioJornada =
                    horarioParaMinutos(
                        document
                            .getElementById(
                                "inicioJornada"
                            )
                            .value
                    );


                const fimJornada =
                    horarioParaMinutos(
                        document
                            .getElementById(
                                "fimJornada"
                            )
                            .value
                    );


                if (
                    inicioJornada >=
                    fimJornada
                ) {

                    throw new Error(
                        "O horário da jornada é inválido."
                    );

                }


                // =================================
                // ORIGEM
                // =================================

                const origemTexto =
                    document
                        .getElementById(
                            "origem"
                        )
                        .value
                        .trim();


                if (
                    !origemTexto
                ) {

                    throw new Error(
                        "Digite o local de saída."
                    );

                }


                resultado.innerHTML =
                    "🔎 Procurando origem...";


                const origem =
                    await buscarEndereco(
                        origemTexto +
                        ", Salvador, Bahia"
                    );


                // =================================
                // ENTREGAS
                // =================================

                const enderecos =
                    document.querySelectorAll(
                        ".endereco"
                    );


                const checkboxes =
                    document.querySelectorAll(
                        ".temHorario"
                    );


                const horarios =
                    document.querySelectorAll(
                        ".horario"
                    );


                const entregas = [];


                // =================================
                // BUSCAR ENDEREÇOS
                // =================================

                for (
                    let i = 0;
                    i < enderecos.length;
                    i++
                ) {


                    const texto =
                        enderecos[i]
                            .value
                            .trim();


                    if (
                        !texto
                    ) {

                        continue;

                    }


                    resultado.innerHTML =
                        `
                        🔎 Procurando:
                        <br>
                        ${texto}
                        `;


                    const local =
                        await buscarEndereco(
                            texto +
                            ", Salvador, Bahia"
                        );


                    const temHorario =
                        checkboxes[i]
                            .checked;


                    let horario =
                        null;


                    if (
                        temHorario
                    ) {

                        horario =
                            horarios[i]
                                .value;


                        if (
                            !horario
                        ) {

                            throw new Error(
                                `Informe o horário da entrega ${i + 1}.`
                            );

                        }

                    }


                    entregas.push({

                        ...local,

                        temHorario:
                            temHorario,

                        horario:
                            horario

                    });

                }


                if (
                    entregas.length === 0
                ) {

                    throw new Error(
                        "Adicione pelo menos uma entrega."
                    );

                }


                // =================================
                // GERAR POSSIBILIDADES
                // =================================

                resultado.innerHTML =
                    `
                    🧠 Analisando as melhores
                    combinações...
                    `;


                const possibilidades =
                    gerarPermutacoes(
                        entregas
                    );


                let melhor =
                    null;


                // =================================
                // TESTAR ROTAS
                // =================================

                for (
                    const ordem
                    of possibilidades
                ) {


                    const avaliacao =
                        await avaliarRota(
                            origem,
                            ordem,
                            inicioJornada,
                            fimJornada
                        );


                    const pontuacao =
                        avaliacao.distancia
                        +
                        avaliacao.penalidade;


                    if (
                        melhor === null
                        ||
                        pontuacao <
                        melhor.pontuacao
                    ) {


                        melhor = {

                            ordem:
                                ordem,

                            avaliacao:
                                avaliacao,

                            pontuacao:
                                pontuacao

                        };

                    }

                }


                // =================================
                // LIMPAR MAPA
                // =================================

                limparMapa();


                const pontos = [

                    origem,

                    ...melhor.ordem

                ];


                // =================================
                // ORIGEM
                // =================================

                const marcadorOrigem =
                    L.marker([

                        origem.lat,

                        origem.lon

                    ])
                    .addTo(mapa)
                    .bindPopup(
                        `
                        <b>🚚 ORIGEM</b>
                        <br>
                        ${origem.nome}
                        `
                    );


                marcadores.push(
                    marcadorOrigem
                );


                // =================================
                // ENTREGAS
                // =================================

                melhor.ordem.forEach(
                    (
                        entrega,
                        index
                    ) => {


                        const marcador =
                            L.marker([

                                entrega.lat,

                                entrega.lon

                            ])
                            .addTo(mapa)
                            .bindPopup(
                                `
                                <b>
                                    📦 ENTREGA ${
                                        index + 1
                                    }
                                </b>

                                <br>

                                ${
                                    entrega.temHorario
                                    ?
                                    `🕐 ${entrega.horario}`
                                    :
                                    `🚚 Sem horário`
                                }
                                `
                            );


                        marcadores.push(
                            marcador
                        );

                    }
                );


                // =================================
                // DESENHAR
                // =================================

                await desenharRota(
                    pontos
                );


                // =================================
                // RESULTADO
                // =================================

                const distancia =
                    (
                        melhor
                            .avaliacao
                            .distancia
                        /
                        1000
                    ).toFixed(1);


                const tempoDirigindo =
                    Math.round(
                        melhor
                            .avaliacao
                            .duracao
                        /
                        60
                    );


                let html = `

                    <h3>
                        🚚 Melhor sequência
                    </h3>


                    <p>
                        🕕 Saída:
                        <strong>
                            ${minutosParaHorario(
                                inicioJornada
                            )}
                        </strong>
                    </p>


                    <hr>

                `;


                // =================================
                // LISTAR ENTREGAS
                // =================================

                melhor.ordem.forEach(
                    (
                        entrega,
                        index
                    ) => {


                        const chegada =
                            melhor
                                .avaliacao
                                .chegadas[
                                    index
                                ];


                        const atraso =
                            melhor
                                .avaliacao
                                .atrasos[
                                    index
                                ];


                        html += `

                            <div style="
                                margin-top:12px;
                                padding:12px;
                                background:white;
                                border-radius:8px;
                            ">

                                <strong>

                                    ${
                                        index + 1
                                    }️⃣

                                    ${
                                        entrega.nome
                                    }

                                </strong>


                                <br>


                                ${
                                    entrega.temHorario

                                    ?

                                    `
                                    🕐 Marcado:
                                    ${entrega.horario}

                                    <br>

                                    🚚 Chegada:
                                    <strong>
                                        ${minutosParaHorario(
                                            chegada
                                        )}
                                    </strong>

                                    ${
                                        atraso > 0

                                        ?

                                        `
                                        <br>

                                        ⏰ Atraso:
                                        ${Math.round(
                                            atraso
                                        )} min
                                        `

                                        :

                                        `
                                        <br>
                                        ✅ No horário
                                        `
                                    }

                                    `

                                    :

                                    `
                                    🚚
                                    <strong>
                                        Sem horário
                                    </strong>

                                    <br>

                                    Chegada estimada:
                                    <strong>
                                        ${minutosParaHorario(
                                            chegada
                                        )}
                                    </strong>
                                    `
                                }

                            </div>

                        `;

                    }
                );


                // =================================
                // RESUMO
                // =================================

                html += `

                    <hr>

                    <p>
                        📦 Entregas:
                        <strong>
                            ${entregas.length}
                        </strong>
                    </p>

                    <p>
                        📏 Distância:
                        <strong>
                            ${distancia} km
                        </strong>
                    </p>

                    <p>
                        🚗 Tempo dirigindo:
                        <strong>
                            ${tempoDirigindo} min
                        </strong>
                    </p>

                    <p>
                        🏁 Final estimado:
                        <strong>
                            ${minutosParaHorario(
                                melhor
                                    .avaliacao
                                    .horarioFinal
                            )}
                        </strong>
                    </p>

                `;


                // =================================
                // STATUS
                // =================================

                if (
                    melhor
                        .avaliacao
                        .horarioFinal
                    >
                    fimJornada
                ) {


                    html += `

                        <div style="
                            margin-top:15px;
                            padding:12px;
                            background:#fee2e2;
                            color:#991b1b;
                            border-radius:8px;
                        ">

                            🚨

                            <strong>
                                Atenção
                            </strong>

                            <br>

                            A rota ultrapassa
                            o encerramento da jornada.

                        </div>

                    `;


                } else {


                    html += `

                        <div style="
                            margin-top:15px;
                            padding:12px;
                            background:#dcfce7;
                            color:#166534;
                            border-radius:8px;
                        ">

                            ✅

                            <strong>
                                Rota dentro da jornada
                            </strong>

                        </div>

                    `;

                }


                resultado.innerHTML =
                    html;


            } catch (
                erro
            ) {


                console.error(
                    erro
                );


                resultado.innerHTML = `

                    <div style="
                        color:#991b1b;
                        background:#fee2e2;
                        padding:12px;
                        border-radius:8px;
                    ">

                        ❌

                        <strong>
                            Erro
                        </strong>

                        <br>

                        ${erro.message}

                    </div>

                `;

            }

        }
    );