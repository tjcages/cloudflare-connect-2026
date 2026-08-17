import React, { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { Mousewheel } from "swiper/modules";
import GridArea from "@/components/GridArea";
import "swiper/css";
import Button from "@/components/Button";
import Icon from "@/components/icon/Icon";
import CarouselCard from "./card/Card";

export default function CarouselContainer({
  data,
}: {
  data: {
    title: string;
    description: string;
    href: string;
    type: "screenshot" | "automation" | "generation";
  }[];
}) {
  const swiperRef = useRef<SwiperType>(null);
  const [isBeginning, setIsBeginning] = useState(true);
  const [isEnd, setIsEnd] = useState(false);

  const syncEdges = (swiper: SwiperType) => {
    setIsBeginning(swiper.isBeginning);
    setIsEnd(swiper.isEnd);
  };

  return (
    <div className="relative">
      <div className="absolute -top-122 right-84 flex gap-8 p-2">
        <Button
          variant="secondary"
          disabled={isBeginning}
          className="p-9!"
          onClick={() => swiperRef.current?.slidePrev()}
        >
          <Icon name="chevron-left-small" size={18} />
        </Button>
        <Button
          variant="secondary"
          disabled={isEnd}
          className="p-9!"
          onClick={() => swiperRef.current?.slideNext()}
        >
          <Icon name="chevron-right-small" size={18} />
        </Button>
      </div>

      <div className="relative z-10 p-40">
        <GridArea className="overlay bg-background-surface" />

        <Swiper
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            syncEdges(swiper);
          }}
          onSlideChange={syncEdges}
          onResize={syncEdges}
          onUpdate={syncEdges}
          slidesPerView="auto"
          modules={[Mousewheel]}
          mousewheel={{
            forceToAxis: true,
          }}
          className="hide-scrollbar relative -my-1 flex w-screen overflow-x-scroll"
          style={
            {
              "--container-width": "min(1200px, 100vw)",
              "--side-padding": "(100vw - var(--container-width)) / 2",
              marginLeft: "calc(-40px - var(--side-padding))",
              padding: "1px calc(40px + var(--side-padding))",
            } as React.CSSProperties
          }
        >
          {data.map((item, i) => (
            <SwiperSlide key={i} className="w-auto!">
              <CarouselCard {...item} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}
