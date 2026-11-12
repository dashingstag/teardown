import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Grid,
  Html,
  Line,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import {
  ancestors,
  rollup,
  type Fixture,
  type Trace,
  type TwinNode,
} from "../shared/domain";
import { colorFor, type Lens } from "./view";
import {
  projectRoutes,
  spanProgress,
  spanState,
  visibleNodes,
  type FlowRoute,
} from "./flow";

type Props = {
  fixture: Fixture;
  scopeId: string;
  selectedId: string;
  lens: Lens;
  exploded: boolean;
  activeIds: string[];
  reducedMotion: boolean;
  motion: boolean;
  trace: Trace;
  traceTime: number;
  resetKey: number;
  onSelect: (id: string) => void;
  onDive: (id: string) => void;
  onFallback: () => void;
  onInteract: () => void;
};

function layout(
  index: number,
  count: number,
  exploded: boolean,
): THREE.Vector3 {
  if (count === 1) return new THREE.Vector3();
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const radius = count > 4 ? 4.6 : 3.1;
  return new THREE.Vector3(
    Math.cos(angle) * radius * (exploded ? 1.16 : 0.88),
    0,
    Math.sin(angle) * radius * (exploded ? 1.16 : 0.88),
  );
}

function Neon({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={opacity}
      toneMapped={false}
    />
  );
}

function ServiceCore({ role, color }: { role: string; color: string }) {
  if (role === "inventory")
    return (
      <group>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0, 0.45 + i * 0.43, 0]}>
            <mesh>
              <cylinderGeometry args={[0.73, 0.73, 0.35, 32]} />
              <meshStandardMaterial
                color="#143c4a"
                metalness={0.6}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.72, 0.025, 8, 40]} />
              <Neon color={color} />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (role === "fraud")
    return (
      <group position={[0, 1, 0]}>
        <mesh>
          <icosahedronGeometry args={[0.57, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.4}
            metalness={0.5}
            roughness={0.3}
          />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[i * 0.9, i * 0.8, 0.5]}>
            <torusGeometry args={[0.92, 0.025, 8, 60]} />
            <Neon color={color} opacity={0.85} />
          </mesh>
        ))}
      </group>
    );
  if (role === "payments")
    return (
      <group>
        {[-1, 0, 1].map((i) => (
          <group key={i} position={[i * 0.56, 0.8 + (i === 0 ? 0.25 : 0), 0]}>
            <RoundedBox args={[0.42, 1.2, 0.7]} radius={0.04}>
              <meshStandardMaterial
                color="#233c63"
                metalness={0.65}
                roughness={0.25}
              />
            </RoundedBox>
            <mesh position={[0, 0, 0.36]}>
              <boxGeometry args={[0.08, 0.9, 0.015]} />
              <Neon color={color} />
            </mesh>
            <mesh position={[0, 0.63, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.08, 0.14, 24]} />
              <Neon color={color} />
            </mesh>
          </group>
        ))}
      </group>
    );
  if (role === "portal")
    return (
      <group position={[0, 0.95, 0]}>
        <RoundedBox args={[1.65, 1.3, 0.18]} radius={0.06}>
          <meshStandardMaterial
            color="#233c4e"
            metalness={0.6}
            roughness={0.3}
          />
        </RoundedBox>
        <mesh position={[0, 0, 0.1]}>
          <planeGeometry args={[1.42, 1.06]} />
          <Neon color={color} opacity={0.15} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.15 + i * 0.16, 0.25 - i * 0.25, 0.12]}>
            <boxGeometry args={[0.9 - i * 0.18, 0.055, 0.025]} />
            <Neon color={color} />
          </mesh>
        ))}
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[0.25, 0.4, 0.25]} />
          <meshStandardMaterial color="#355063" />
        </mesh>
      </group>
    );
  if (role === "recommendations")
    return (
      <group>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[
              Math.cos(i * 1.6) * 0.5,
              0.6 + i * 0.3,
              Math.sin(i * 1.6) * 0.5,
            ]}
            rotation={[0.4, i, 0.3]}
          >
            <octahedronGeometry args={[0.36, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.3}
              metalness={0.5}
              roughness={0.2}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.7, 48]} />
          <Neon color={color} />
        </mesh>
      </group>
    );
  return (
    <group>
      <RoundedBox args={[1.4, 0.75, 1.2]} radius={0.08} position={[0, 0.75, 0]}>
        <meshStandardMaterial
          color="#21414c"
          metalness={0.6}
          roughness={0.25}
        />
      </RoundedBox>
      <mesh position={[0, 1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.85, 0.72]} />
        <Neon color={color} opacity={0.7} />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [0, 1, 2, 3].map((i) => (
          <mesh
            key={`${side}:${i}`}
            position={[side * 0.84, 0.67, -0.42 + i * 0.28]}
          >
            <boxGeometry args={[0.27, 0.07, 0.09]} />
            <Neon color={color} />
          </mesh>
        )),
      )}
      <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.28, 0]} />
        <Neon color={color} />
      </mesh>
    </group>
  );
}

function Module({
  node,
  index,
  count,
  ...props
}: Props & { node: TwinNode; index: number; count: number }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const scan = useRef<THREE.Mesh>(null);
  const time = useRef(0);
  const [hovered, setHovered] = useState(false);
  const target = useMemo(
    () => layout(index, count, props.exploded),
    [index, count, props.exploded],
  );
  const initialPosition = useRef(target);
  const selected = props.selectedId === node.id;
  const active = props.activeIds.some((id) =>
    ancestors(props.fixture, id).some((a) => a.id === node.id),
  );
  const traceError =
    props.lens === "runtime" &&
    props.trace.spans.some(
      (s) =>
        s.status === "error" &&
        spanState(s, props.traceTime) === "active" &&
        ancestors(props.fixture, s.nodeId).some((a) => a.id === node.id),
    );
  const color = traceError
    ? "#ff727f"
    : active
      ? "#7cffe3"
      : colorFor(props.fixture, node, props.lens);
  const role =
    node.id.includes("fraud") || node.id.includes("velocity")
      ? "fraud"
      : (ancestors(props.fixture, node.id)[1]?.id ?? "checkout");
  const animate = props.motion && !props.reducedMotion;
  useFrame((_, delta) => {
    if (animate) time.current += delta;
    if (!group.current || !core.current || !halo.current || !scan.current)
      return;
    const ease = props.reducedMotion ? 1 : 1 - Math.exp(-delta * 6);
    group.current.position.lerp(target, ease);
    core.current.position.y = THREE.MathUtils.lerp(
      core.current.position.y,
      (props.exploded ? 0.6 : 0.05) + (selected ? 0.18 : 0),
      ease,
    );
    core.current.rotation.y = Math.sin(time.current * 0.3 + index) * 0.12;
    halo.current.scale.setScalar(
      1 + (active ? 0.15 : 0.04) * Math.sin(time.current * (active ? 4 : 1.4)),
    );
    (halo.current.material as THREE.MeshBasicMaterial).opacity = active
      ? 0.85
      : hovered || selected
        ? 0.6
        : 0.2;
    scan.current.position.y = animate
      ? 0.3 + ((time.current * 0.35 + index * 0.2) % 1) * 1.9
      : 0.65;
    scan.current.visible = active || selected || hovered;
  });
  return (
    <group ref={group} position={initialPosition.current}>
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          props.onSelect(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          props.onDive(node.id);
        }}
      >
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[1.38, 1.52, 0.22, 6]} />
          <meshStandardMaterial
            color={selected || hovered ? "#294859" : "#142636"}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[1.29, 1.33, 6]} />
          <Neon color={color} opacity={0.8} />
        </mesh>
        <mesh
          ref={halo}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.21, 0]}
        >
          <ringGeometry args={[1.44, 1.55, 64]} />
          <Neon color={color} opacity={0.3} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
          <circleGeometry args={[1.85, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={active ? 0.09 : 0.025}
            depthWrite={false}
          />
        </mesh>
        <group ref={core}>
          <ServiceCore role={role} color={color} />
        </group>
        <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.03, 1.07, 64]} />
          <Neon color={color} opacity={0.45} />
        </mesh>
        {props.exploded && (
          <Line
            points={[
              [0, 0.05, 0],
              [0, 0.7, 0],
            ]}
            color={color}
            dashed
            dashSize={0.08}
            gapSize={0.08}
            opacity={0.4}
            transparent
          />
        )}
      </group>
      <Html center position={[0, -0.65, 0]} zIndexRange={[10, 0]}>
        <button
          className={`node-label sculpture-label ${selected ? "selected" : ""} ${active ? "trace-active" : ""} ${traceError ? "trace-error" : ""}`}
          onClick={() => props.onSelect(node.id)}
          onDoubleClick={() => props.onDive(node.id)}
        >
          <span className="status-dot" style={{ background: color }} />
          <span>
            {node.name}
            <small>
              {traceError
                ? "TIMEOUT SPAN"
                : active
                  ? "PROCESSING SPAN"
                  : node.kind}
              {props.lens === "risk"
                ? ` · ${rollup(props.fixture, node.id).score ?? "?"} RISK`
                : ""}
            </small>
          </span>
          {props.lens === "risk" &&
            rollup(props.fixture, node.id).unknown > 0 && (
              <span className="purple" title="Contains unknown risk">
                ?
              </span>
            )}
        </button>
      </Html>
    </group>
  );
}

function RequestRoute({
  route,
  nodes,
  ...props
}: Props & { route: FlowRoute; nodes: TwinNode[] }) {
  const packets = useRef<THREE.Group>(null);
  const time = useRef(0);
  const curve = useMemo(() => {
    const a = layout(
      nodes.findIndex((n) => n.id === route.from),
      nodes.length,
      props.exploded,
    );
    const b = layout(
      nodes.findIndex((n) => n.id === route.to),
      nodes.length,
      props.exploded,
    );
    a.y = b.y = 0.5;
    return new THREE.CubicBezierCurve3(
      a,
      a.clone().lerp(b, 0.22).setY(2.7),
      a.clone().lerp(b, 0.78).setY(2.7),
      b,
    );
  }, [route.from, route.to, nodes.length, props.exploded]);
  const points = useMemo(() => curve.getPoints(40), [curve]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const traceSpans = props.trace.spans.filter((s) =>
    route.spanIds.includes(s.id),
  );
  const activeSpan = traceSpans.find(
    (s) => spanState(s, props.traceTime) === "active",
  );
  const runtime = props.lens === "runtime";
  const color = runtime
    ? activeSpan?.status === "error"
      ? "#ff727f"
      : "#7cffe3"
    : colorFor(
        props.fixture,
        nodes.find((n) => n.id === route.to)!,
        props.lens,
      );
  const arrowPosition = useMemo(() => curve.getPoint(0.86), [curve]);
  const arrowRotation = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        curve.getTangent(0.86).normalize(),
      ),
    [curve],
  );
  useFrame((_, delta) => {
    if (props.motion && !props.reducedMotion) time.current += delta;
    if (!packets.current) return;
    packets.current.visible = runtime ? !!activeSpan : true;
    const progress =
      runtime && activeSpan
        ? spanProgress(activeSpan, props.traceTime)
        : (time.current * 0.2) % 1;
    packets.current.children.forEach((packet, i) => {
      const t = runtime
        ? Math.max(0, progress - i * 0.045)
        : (progress + i / 3) % 1;
      curve.getPoint(t, target);
      packet.position.copy(target);
    });
  });
  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={activeSpan ? 10 : 6}
        transparent
        opacity={activeSpan ? 0.11 : 0.045}
        depthWrite={false}
      />
      <Line
        points={points}
        color={color}
        lineWidth={activeSpan ? 2.4 : 1.2}
        transparent
        opacity={runtime ? (activeSpan ? 0.8 : 0.12) : 0.38}
      />
      <mesh position={arrowPosition} quaternion={arrowRotation}>
        <coneGeometry args={[0.085, 0.25, 8]} />
        <Neon color={color} opacity={runtime && !activeSpan ? 0.12 : 0.65} />
      </mesh>
      <group ref={packets}>
        {[0, 1, 2].map((i) => (
          <group key={i}>
            <mesh>
              <sphereGeometry
                args={[runtime ? 0.105 - i * 0.018 : 0.065, 10, 8]}
              />
              <Neon color={color} opacity={runtime ? 1 - i * 0.25 : 1} />
            </mesh>
            <mesh>
              <sphereGeometry
                args={[runtime ? 0.24 - i * 0.03 : 0.17, 10, 8]}
              />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.12}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function World(props: Props) {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const { size } = useThree();
  const nodes = useMemo(
    () => visibleNodes(props.fixture, props.scopeId),
    [props.fixture, props.scopeId],
  );
  const routes = useMemo(
    () => projectRoutes(props.fixture, props.scopeId, props.trace),
    [props.fixture, props.scopeId, props.trace],
  );
  useEffect(() => {
    const distance =
      (nodes.length > 4 ? 1 : nodes.length === 1 ? 0.55 : 0.76) *
      Math.max(1, 1.05 / (size.width / size.height));
    void controls.current?.setLookAt(
      13 * distance,
      14 * distance,
      17 * distance,
      0,
      0.5,
      0,
      !props.reducedMotion,
    );
  }, [
    props.scopeId,
    props.resetKey,
    props.reducedMotion,
    nodes.length,
    size.width,
    size.height,
  ]);
  return (
    <>
      <color attach="background" args={["#080f1c"]} />
      <fog attach="fog" args={["#080f1c", 30, 65]} />
      <ambientLight intensity={1.3} />
      <hemisphereLight args={["#80c8ff", "#0b1429", 1.7]} />
      <directionalLight position={[8, 15, 5]} intensity={3.5} color="#c0dfef" />
      <pointLight position={[-7, 6, -5]} intensity={65} color="#507bfa" />
      <Grid
        position={[0, -0.28, 0]}
        args={[60, 60]}
        cellSize={0.7}
        sectionSize={3.5}
        cellColor="#14273c"
        sectionColor="#28455b"
        fadeDistance={30}
        fadeStrength={1.8}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#080f1c" roughness={0.8} />
      </mesh>
      {[6.7, 7.1, 9].map((radius, i) => (
        <mesh
          key={radius}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.24, 0]}
        >
          <ringGeometry args={[radius, radius + 0.015, 100]} />
          <Neon color="#4f82b7" opacity={i === 0 ? 0.3 : 0.12} />
        </mesh>
      ))}
      {routes.map((route) => (
        <RequestRoute key={route.id} route={route} nodes={nodes} {...props} />
      ))}
      {nodes.map((node, index) => (
        <Module
          key={node.id}
          {...props}
          node={node}
          index={index}
          count={nodes.length}
        />
      ))}
      <CameraControls
        ref={controls}
        minDistance={6}
        maxDistance={55}
        maxPolarAngle={Math.PI * 0.47}
        dollySpeed={0.7}
        onControlStart={props.onInteract}
      />
    </>
  );
}
export default function Scene(props: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [13, 14, 17], fov: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      fallback={
        <div className="scene-fallback">
          <p>WebGL is unavailable on this device.</p>
          <button className="button" onClick={props.onFallback}>
            Open accessible 2D map
          </button>
        </div>
      }
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", props.onFallback, {
          once: true,
        });
      }}
    >
      <World {...props} />
    </Canvas>
  );
}
