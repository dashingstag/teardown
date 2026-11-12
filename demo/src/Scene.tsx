import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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
  childrenOf,
  rollup,
  type Fixture,
  type TwinNode,
} from "../shared/domain";
import { colorFor, type Lens } from "./view";

type Props = {
  fixture: Fixture;
  scopeId: string;
  selectedId: string;
  lens: Lens;
  exploded: boolean;
  activeIds: string[];
  reducedMotion: boolean;
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
): [number, number, number] {
  const columns = count > 4 ? 3 : 2;
  const rows = Math.ceil(count / columns);
  const gap = exploded ? 4.5 : 2.7;
  return [
    ((index % columns) - (Math.min(columns, count) - 1) / 2) * gap,
    0,
    (Math.floor(index / columns) - (rows - 1) / 2) * gap,
  ];
}
function Module({
  node,
  index,
  count,
  ...props
}: Omit<Props, "onFallback"> & {
  node: TwinNode;
  index: number;
  count: number;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const target = layout(index, count, props.exploded);
  const initialPosition = useRef(target);
  const color = colorFor(props.fixture, node, props.lens);
  const selected = props.selectedId === node.id;
  const active = props.activeIds.some((id) =>
    ancestors(props.fixture, id).some((a) => a.id === node.id),
  );
  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const y = props.reducedMotion
      ? 0.2
      : 0.2 + Math.sin(clock.elapsedTime * 0.6 + index) * 0.06;
    const position = new THREE.Vector3(
      target[0],
      y + (selected ? 0.35 : 0),
      target[2],
    );
    if (props.reducedMotion) group.current.position.copy(position);
    else group.current.position.lerp(position, 1 - Math.exp(-delta * 6));
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
        <RoundedBox
          args={[2.45, 0.22, 2.1]}
          radius={0.09}
          position={[0, 0.1, 0]}
        >
          <meshStandardMaterial
            color="#263342"
            metalness={0.65}
            roughness={0.35}
          />
        </RoundedBox>
        {[0, 1, 2].map((layer) => (
          <group
            key={layer}
            position={[0, 0.35 + layer * (props.exploded ? 0.38 : 0.23), 0]}
          >
            <RoundedBox args={[2.18, 0.16, 1.82]} radius={0.055}>
              <meshStandardMaterial
                color={selected || hovered ? "#2b4654" : "#1d2b38"}
                metalness={0.5}
                roughness={0.35}
              />
            </RoundedBox>
            <mesh position={[0, 0.085, 0.83]}>
              <boxGeometry args={[1.7, 0.025, 0.025]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={active ? 1 : 0.65}
              />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} position={[-0.72 + i * 0.35, 0.095, 0.22]}>
                <boxGeometry args={[0.19, 0.055, 0.55]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={active ? 1.2 : 0.12}
                  transparent
                  opacity={0.75}
                />
              </mesh>
            ))}
          </group>
        ))}
        <RoundedBox
          args={[1.65, 0.16, 1.28]}
          radius={0.05}
          position={[0, props.exploded ? 1.42 : 1.05, 0]}
        >
          <meshStandardMaterial
            color={color}
            metalness={0.3}
            roughness={0.45}
            transparent
            opacity={selected ? 0.8 : 0.32}
          />
        </RoundedBox>
        {(selected || active) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
            <ringGeometry args={[1.55, 1.59, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        )}
      </group>
      <Html
        center
        position={[0, props.exploded ? 2.2 : 1.85, 0]}
        zIndexRange={[10, 0]}
      >
        <button
          className={`node-label ${selected ? "selected" : ""} ${active ? "trace-active" : ""}`}
          onClick={() => props.onSelect(node.id)}
          onDoubleClick={() => props.onDive(node.id)}
        >
          <span className="status-dot" style={{ background: color }} />
          {node.name}
          {props.lens === "risk" &&
            rollup(props.fixture, node.id).unknown > 0 && (
              <span className="purple" title="Contains unknown risk">
                ?
              </span>
            )}
          <small>{node.kind}</small>
        </button>
      </Html>
    </group>
  );
}
function World(props: Props) {
  const controls = useRef<ComponentRef<typeof CameraControls>>(null);
  const nodes = childrenOf(props.fixture, props.scopeId);
  const display = nodes.length
    ? nodes
    : props.fixture.nodes.filter((n) => n.id === props.scopeId);
  useEffect(() => {
    const depth = ancestors(props.fixture, props.scopeId).length - 1;
    const distance =
      display.length > 4 ? 1 : Math.max(0.62, 0.84 - depth * 0.04);
    void controls.current?.setLookAt(
      11 * distance,
      12 * distance,
      15 * distance,
      0,
      0.4,
      0,
      !props.reducedMotion,
    );
  }, [
    props.scopeId,
    props.resetKey,
    props.reducedMotion,
    props.fixture,
    display.length,
  ]);
  const projectedEdges = new Map<
    string,
    { from: number; to: number; active: boolean }
  >();
  for (const edge of props.fixture.edges) {
    const from = display.findIndex((n) =>
      ancestors(props.fixture, edge.from).some((a) => a.id === n.id),
    );
    const to = display.findIndex((n) =>
      ancestors(props.fixture, edge.to).some((a) => a.id === n.id),
    );
    if (from < 0 || to < 0 || from === to) continue;
    const key = `${from}-${to}`;
    projectedEdges.set(key, {
      from,
      to,
      active:
        props.activeIds.includes(edge.from) &&
        props.activeIds.includes(edge.to),
    });
  }
  return (
    <>
      <color attach="background" args={["#0d151f"]} />
      <fog attach="fog" args={["#0d151f", 25, 60]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[8, 15, 5]} intensity={3} color="#c0dfef" />
      <pointLight position={[-8, 7, -5]} intensity={45} color="#5ac1c2" />
      <Grid
        position={[0, -0.12, 0]}
        args={[50, 50]}
        cellSize={1}
        sectionSize={5}
        cellColor="#20313c"
        sectionColor="#2e4652"
        fadeDistance={28}
        fadeStrength={1.6}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0d151f" roughness={1} />
      </mesh>
      {[...projectedEdges.entries()].map(([key, edge]) => {
        const a = layout(edge.from, display.length, props.exploded);
        const b = layout(edge.to, display.length, props.exploded);
        return (
          <Line
            key={key}
            points={[
              [a[0], 0.05, a[2]],
              [a[0], 0.05, b[2]],
              [b[0], 0.05, b[2]],
            ]}
            color={
              edge.active
                ? "#75f2d0"
                : props.lens === "risk"
                  ? "#755250"
                  : "#395660"
            }
            lineWidth={edge.active ? 2.5 : 1}
            transparent
            opacity={edge.active ? 1 : 0.65}
          />
        );
      })}
      {display.map((node, index) => (
        <Module
          key={node.id}
          {...props}
          node={node}
          index={index}
          count={display.length}
        />
      ))}
      <CameraControls
        ref={controls}
        minDistance={6}
        maxDistance={32}
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
      camera={{ position: [11, 12, 15], fov: 40 }}
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
